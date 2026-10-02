"""
LeadFlow CRM — Google Maps Scraping Engine
Scrapes businesses from Google Maps, extracts details,
filters by website presence, and pushes to Supabase with duplicate prevention.
"""

import os
import sys
import time
import json
import random
import re
from datetime import datetime

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        TimeoutException,
        NoSuchElementException,
        StaleElementReferenceException,
        WebDriverException,
    )
except ImportError:
    print("❌ Missing selenium. Run: pip install selenium")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    create_client = None
    print("⚠️ supabase-py not installed. Will save to local JSON. Run: pip install supabase")


# ============================================================
# CONFIGURATION
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Tables
TABLE_WITH_WEBSITE = "leads_with_website"
TABLE_WITHOUT_WEBSITE = "leads_without_website"

# Scraping behavior
SCROLL_PAUSE = 2           # seconds between scrolls
MAX_RESULTS_PER_QUERY = 40 # max leads per search query
PAGE_LOAD_WAIT = 10        # seconds to wait for page elements


# ============================================================
# PREDEFINED SEARCH QUERIES
# ============================================================

BUSINESS_CATEGORIES = [
    # Healthcare
    "Clinics",
    "Medical Stores",
    "Dentists",
    "Physiotherapy Centers",
    "Hospitals",
    "Pharmacies",
    # Real Estate
    "Property Dealers",
    "Real Estate Agencies",
    "Builders and Developers",
    # Fitness & Wellness
    "Gyms",
    "Yoga Studios",
    "Salons",
    "Spas",
    "Beauty Parlors",
    # Professional Services
    "Law Firms",
    "Accounting Firms",
    "Architecture Firms",
    "Tax Consultants",
    # Education
    "Coaching Centers",
    "Training Institutes",
    "Private Schools",
    "Tuition Centers",
    # Automotive
    "Car Dealerships",
    "Auto Repair Shops",
    "Car Wash",
    # Hospitality & Events
    "Event Planners",
    "Wedding Halls",
    "Travel Agencies",
    "Hotels",
    "Restaurants",
    "Catering Services",
]

CITIES = [
    "Lahore",
    "Karachi",
    "Islamabad",
    "Rawalpindi",
    "Faisalabad",
    "Peshawar",
    "Multan",
    "Gujranwala",
    "Sialkot",
    "Quetta",
]


# ============================================================
# SUPABASE HELPER
# ============================================================

class SupabaseStore:
    """Handles Supabase upsert with duplicate prevention on phone_number."""

    def __init__(self, url, key):
        self.client = None
        self.local_seen = set()  # in-memory duplicate tracking
        if url and key and create_client:
            try:
                self.client = create_client(url, key)
                print("✅ Supabase connected successfully")
            except Exception as e:
                print(f"⚠️ Supabase connection failed: {e}")
                print("   Will save leads to local JSON files instead.")

    def _normalize_phone(self, phone):
        """Strip all non-digits for consistent comparison."""
        if not phone:
            return ""
        return re.sub(r'\D', '', str(phone))

    def insert_lead(self, lead_data):
        """
        Insert a lead. Returns:
          'inserted' — new lead saved
          'duplicate' — already exists, skipped
          'error' — something went wrong
        """
        phone = self._normalize_phone(lead_data.get("phone_number", ""))
        if not phone:
            return "error"

        # In-memory duplicate check (fast)
        if phone in self.local_seen:
            return "duplicate"
        self.local_seen.add(phone)

        has_website = bool(lead_data.get("website_url", "").strip())
        table = TABLE_WITH_WEBSITE if has_website else TABLE_WITHOUT_WEBSITE

        record = {
            "business_name": lead_data.get("business_name", "Unknown"),
            "phone_number": phone,
            "address": lead_data.get("address", ""),
            "rating": lead_data.get("rating", 0),
            "reviews": lead_data.get("reviews", 0),
            "status": "New",
            "whatsapp_status": "uncontacted",
        }

        if has_website:
            record["website_url"] = lead_data["website_url"].strip()

        if self.client:
            try:
                # Use upsert with phone_number as the conflict column
                # This ensures no duplicates at the database level
                result = self.client.table(table).upsert(
                    record,
                    on_conflict="phone_number"
                ).execute()
                return "inserted"
            except Exception as e:
                error_msg = str(e)
                if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                    return "duplicate"
                print(f"  ⚠️ Supabase error: {error_msg}")
                return "error"
        else:
            # Fallback: save to local JSON
            self._save_local(table, record)
            return "inserted"

    def _save_local(self, table, record):
        """Fallback: append to a local JSON file."""
        filepath = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            f"{table}.json"
        )
        existing = []
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except (json.JSONDecodeError, IOError):
                existing = []

        # Check for duplicates in local file
        existing_phones = {r.get("phone_number") for r in existing}
        if record["phone_number"] not in existing_phones:
            record["created_at"] = datetime.now().isoformat()
            existing.append(record)
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2, ensure_ascii=False)


# ============================================================
# GOOGLE MAPS SCRAPER
# ============================================================

class GoogleMapsScraper:
    """
    Scrapes Google Maps search results for business listings.
    Extracts: name, phone, address, website, rating, reviews.
    """

    def __init__(self, headless=False):
        self.driver = None
        self.headless = headless

    def start_browser(self):
        """Initialize the browser (Chrome preferred, Safari fallback)."""
        # Try Chrome first
        try:
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            from selenium.webdriver.chrome.service import Service as ChromeService

            chrome_options = ChromeOptions()
            if self.headless:
                chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--window-size=1400,900")
            chrome_options.add_argument("--lang=en-US")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])

            try:
                from webdriver_manager.chrome import ChromeDriverManager
                service = ChromeService(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception:
                self.driver = webdriver.Chrome(options=chrome_options)

            print("✅ Chrome browser launched")
            return True
        except Exception as e:
            print(f"⚠️ Chrome not available: {e}")

        # Fallback to Safari
        try:
            self.driver = webdriver.Safari()
            print("✅ Safari browser launched")
            return True
        except Exception as e:
            print(f"❌ No browser available: {e}")
            return False

    def close_browser(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass

    def scrape_query(self, query, callback=None):
        """
        Scrape Google Maps for a given search query.
        
        Args:
            query: Search string like "Dentists in Lahore"
            callback: Optional function called for each result with (event_type, data)
                      event_type: 'log', 'lead_found', 'duplicate', 'error', 'progress'
        
        Returns:
            List of extracted lead dictionaries
        """
        leads = []

        def emit(event_type, data):
            if callback:
                callback(event_type, data)

        emit("log", {"type": "info", "text": f"🔍 Searching Google Maps: \"{query}\""})

        # Navigate to Google Maps search
        search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
        self.driver.get(search_url)

        # Wait for results panel to load
        try:
            WebDriverWait(self.driver, PAGE_LOAD_WAIT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed'], div.Nv2PK"))
            )
            emit("log", {"type": "success", "text": "✅ Search results loaded"})
        except TimeoutException:
            emit("log", {"type": "error", "text": "❌ Timeout waiting for results to load"})
            return leads

        # Scroll through results to load more
        results_found = 0
        scroll_attempts = 0
        max_scroll_attempts = 15

        # Find the scrollable results panel
        try:
            scrollable = self.driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
        except NoSuchElementException:
            try:
                scrollable = self.driver.find_element(By.CSS_SELECTOR, "div.m6QErb.DxyBCb.kA9KIf.dS8AEf")
            except NoSuchElementException:
                emit("log", {"type": "error", "text": "❌ Cannot find scrollable results panel"})
                return leads

        emit("log", {"type": "info", "text": "📜 Scrolling through results..."})

        while results_found < MAX_RESULTS_PER_QUERY and scroll_attempts < max_scroll_attempts:
            # Scroll down
            self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable)
            time.sleep(SCROLL_PAUSE)
            scroll_attempts += 1

            # Check for "end of results" indicator
            try:
                end_marker = self.driver.find_element(By.CSS_SELECTOR, "span.HlvSq")
                if end_marker:
                    emit("log", {"type": "info", "text": "📄 Reached end of results"})
                    break
            except NoSuchElementException:
                pass

            # Count current results
            items = self.driver.find_elements(By.CSS_SELECTOR, "div.Nv2PK")
            results_found = len(items)

            emit("log", {"type": "info", "text": f"   Found {results_found} listings so far..."})

        # Now extract data from each listing
        listings = self.driver.find_elements(By.CSS_SELECTOR, "div.Nv2PK")
        emit("log", {"type": "info", "text": f"📋 Processing {len(listings)} listings..."})

        for index, listing in enumerate(listings[:MAX_RESULTS_PER_QUERY]):
            try:
                lead = self._extract_listing(listing, index, emit)
                if lead and lead.get("phone_number"):
                    leads.append(lead)
                    emit("lead_found", lead)
            except StaleElementReferenceException:
                emit("log", {"type": "warning", "text": f"   ⚠️ Listing {index + 1} became stale, skipping"})
                continue
            except Exception as e:
                emit("log", {"type": "warning", "text": f"   ⚠️ Error on listing {index + 1}: {str(e)[:60]}"})
                continue

        emit("log", {"type": "success", "text": f"🏁 Extracted {len(leads)} leads with phone numbers from \"{query}\""})
        return leads

    def _extract_listing(self, listing, index, emit):
        """Click into a listing and extract all available data."""
        lead = {
            "business_name": "",
            "phone_number": "",
            "address": "",
            "website_url": "",
            "rating": 0,
            "reviews": 0,
        }

        # Click the listing to open its details panel
        try:
            listing.click()
            time.sleep(2)  # Wait for detail panel to load
        except Exception:
            return None

        # Extract Business Name
        try:
            name_el = self.driver.find_element(By.CSS_SELECTOR, "h1.DUwDvf, h1.fontHeadlineLarge")
            lead["business_name"] = name_el.text.strip()
        except NoSuchElementException:
            try:
                name_el = listing.find_element(By.CSS_SELECTOR, "div.qBF1Pd, a.hfpxzc")
                lead["business_name"] = name_el.get_attribute("aria-label") or name_el.text.strip()
            except NoSuchElementException:
                return None

        if not lead["business_name"]:
            return None

        # Extract Rating
        try:
            rating_el = self.driver.find_element(By.CSS_SELECTOR, "div.F7nice span[aria-hidden='true']")
            lead["rating"] = float(rating_el.text.strip().replace(",", "."))
        except (NoSuchElementException, ValueError):
            pass

        # Extract Reviews count
        try:
            reviews_el = self.driver.find_element(By.CSS_SELECTOR, "div.F7nice span[aria-label*='review']")
            reviews_text = reviews_el.get_attribute("aria-label") or ""
            numbers = re.findall(r'[\d,]+', reviews_text)
            if numbers:
                lead["reviews"] = int(numbers[0].replace(",", ""))
        except (NoSuchElementException, ValueError):
            pass

        # Extract details from the info buttons/links in the detail panel
        try:
            info_buttons = self.driver.find_elements(By.CSS_SELECTOR, "button[data-item-id], a[data-item-id]")
            for btn in info_buttons:
                data_id = btn.get_attribute("data-item-id") or ""
                aria_label = btn.get_attribute("aria-label") or ""
                text = btn.text.strip()

                # Phone number
                if data_id.startswith("phone:") or "phone" in data_id:
                    phone = data_id.replace("phone:tel:", "").replace("phone:", "")
                    lead["phone_number"] = re.sub(r'\D', '', phone)
                elif "Phone:" in aria_label or "phone" in aria_label.lower():
                    phone = aria_label.replace("Phone:", "").strip()
                    lead["phone_number"] = re.sub(r'\D', '', phone)

                # Website
                if data_id == "authority" or data_id.startswith("authority"):
                    href = btn.get_attribute("href") or ""
                    if href and "google" not in href:
                        lead["website_url"] = href
                elif "website" in aria_label.lower():
                    href = btn.get_attribute("href") or ""
                    if href and "google" not in href:
                        lead["website_url"] = href

                # Address
                if data_id.startswith("address") or "Address:" in aria_label:
                    lead["address"] = aria_label.replace("Address:", "").strip() or text
        except Exception:
            pass

        # Fallback: try to get address from the detail panel
        if not lead["address"]:
            try:
                addr_el = self.driver.find_element(
                    By.CSS_SELECTOR,
                    "button[data-item-id='address'] div.Io6YTe, button[data-item-id^='address'] div.fontBodyMedium"
                )
                lead["address"] = addr_el.text.strip()
            except NoSuchElementException:
                pass

        # Fallback: try to get phone from clipboard icon area
        if not lead["phone_number"]:
            try:
                phone_elements = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    "button[data-tooltip='Copy phone number'], button[aria-label*='Phone']"
                )
                for pe in phone_elements:
                    aria = pe.get_attribute("aria-label") or ""
                    if aria:
                        digits = re.sub(r'\D', '', aria)
                        if len(digits) >= 10:
                            lead["phone_number"] = digits
                            break
            except Exception:
                pass

        if lead["phone_number"]:
            status = "🌐 HAS WEBSITE" if lead["website_url"] else "🚫 NO WEBSITE"
            emit("log", {
                "type": "success",
                "text": f"   ✅ [{index + 1}] {lead['business_name']} — +{lead['phone_number']} [{status}]"
            })
        else:
            emit("log", {
                "type": "warning",
                "text": f"   ⚠️ [{index + 1}] {lead['business_name']} — No phone number found, skipping"
            })

        # Go back to results list
        try:
            back_btn = self.driver.find_element(By.CSS_SELECTOR, "button[aria-label='Back']")
            back_btn.click()
            time.sleep(1)
        except NoSuchElementException:
            self.driver.back()
            time.sleep(1)

        return lead if lead["phone_number"] else None


# ============================================================
# MAIN RUNNER
# ============================================================

def run_scraper(
    categories=None,
    cities=None,
    custom_queries=None,
    supabase_url=None,
    supabase_key=None,
    headless=False,
    callback=None,
):
    """
    Main entry point to run the scraper.
    
    Args:
        categories: List of business categories to search (uses BUSINESS_CATEGORIES if None)
        cities: List of cities to search in (uses CITIES if None)
        custom_queries: List of custom "Category in City" strings (overrides categories+cities)
        supabase_url: Supabase project URL
        supabase_key: Supabase anon key
        headless: Run browser in headless mode
        callback: Function(event_type, data) for real-time updates
    
    Returns:
        Dict with stats: { total, with_website, without_website, duplicates, errors }
    """

    def emit(event_type, data):
        if callback:
            callback(event_type, data)
        if event_type == "log":
            prefix = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌"}.get(data.get("type", ""), "")
            print(f"  {prefix} {data.get('text', '')}")

    stats = {"total": 0, "with_website": 0, "without_website": 0, "duplicates": 0, "errors": 0}

    # Build queries
    if custom_queries:
        queries = custom_queries
    else:
        cats = categories or BUSINESS_CATEGORIES
        target_cities = cities or CITIES
        queries = [f"{cat} in {city}" for city in target_cities for cat in cats]

    emit("log", {"type": "info", "text": f"📋 Total search queries to process: {len(queries)}"})

    # Initialize storage
    url = supabase_url or SUPABASE_URL
    key = supabase_key or SUPABASE_KEY
    store = SupabaseStore(url, key)

    # Initialize browser
    scraper = GoogleMapsScraper(headless=headless)
    if not scraper.start_browser():
        emit("log", {"type": "error", "text": "❌ Failed to launch browser. Aborting."})
        return stats

    try:
        for qi, query in enumerate(queries, 1):
            emit("log", {"type": "info", "text": f"\n{'='*60}"})
            emit("log", {"type": "info", "text": f"🔎 Query {qi}/{len(queries)}: {query}"})
            emit("log", {"type": "info", "text": f"{'='*60}"})
            emit("progress", {"current": qi, "total": len(queries), "query": query})

            try:
                leads = scraper.scrape_query(query, callback=callback)

                for lead in leads:
                    result = store.insert_lead(lead)
                    stats["total"] += 1

                    if result == "inserted":
                        if lead.get("website_url"):
                            stats["with_website"] += 1
                            emit("log", {"type": "success", "text": f"   💾 Inserted → {TABLE_WITH_WEBSITE}: {lead['business_name']}"})
                        else:
                            stats["without_website"] += 1
                            emit("log", {"type": "success", "text": f"   💾 Inserted → {TABLE_WITHOUT_WEBSITE}: {lead['business_name']}"})
                    elif result == "duplicate":
                        stats["duplicates"] += 1
                        emit("log", {"type": "warning", "text": f"   🔄 Duplicate skipped: {lead['business_name']} (+{lead['phone_number']})"})
                    else:
                        stats["errors"] += 1

                # Random delay between queries to avoid rate limiting
                if qi < len(queries):
                    delay = random.randint(5, 12)
                    emit("log", {"type": "info", "text": f"   ⏳ Cooling down {delay}s before next query..."})
                    time.sleep(delay)

            except Exception as e:
                emit("log", {"type": "error", "text": f"   ❌ Error on query \"{query}\": {str(e)[:80]}"})
                stats["errors"] += 1
                continue

    finally:
        scraper.close_browser()
        emit("log", {"type": "info", "text": "\n" + "=" * 60})
        emit("log", {"type": "success", "text": f"🏁 SCRAPING COMPLETE"})
        emit("log", {"type": "info", "text": f"   Total processed : {stats['total']}"})
        emit("log", {"type": "info", "text": f"   With website    : {stats['with_website']}"})
        emit("log", {"type": "info", "text": f"   Without website : {stats['without_website']}"})
        emit("log", {"type": "info", "text": f"   Duplicates      : {stats['duplicates']}"})
        emit("log", {"type": "info", "text": f"   Errors          : {stats['errors']}"})
        emit("log", {"type": "info", "text": "=" * 60})
        emit("done", stats)

    return stats


# ============================================================
# CLI ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="LeadFlow Google Maps Scraper")
    parser.add_argument("--categories", nargs="+", help="Business categories to scrape")
    parser.add_argument("--cities", nargs="+", help="Cities to scrape in")
    parser.add_argument("--query", nargs="+", help="Custom queries (e.g., 'Gyms in Lahore')")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--supabase-url", help="Supabase project URL")
    parser.add_argument("--supabase-key", help="Supabase anon key")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  ⚡ LeadFlow — Google Maps Scraper Engine")
    print("=" * 60 + "\n")

    run_scraper(
        categories=args.categories,
        cities=args.cities,
        custom_queries=args.query,
        supabase_url=args.supabase_url,
        supabase_key=args.supabase_key,
        headless=args.headless,
    )
