"""
WhatsApp Bulk Sender Script
Based on the Complete Guide specifications.
"""

import os
import sys
import time
import random
import urllib.parse
from datetime import datetime

try:
    import pandas as pd
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError as e:
    print(f"❌ Missing dependencies: {e}")
    print("Please run: pip install selenium pandas webdriver-manager")
    sys.exit(1)

# ✏️  EDIT THIS — Your message
MESSAGE = """Salam. Badar here. I noticed something about your 
clinic's online presence and had an idea that could 
bring more patient inquiries. If you're open, I can share it."""

# ================= Configuration =================
CSV_FILE = "contacts.csv"
MAX_MESSAGES_PER_SESSION = 50
MIN_DELAY_SECONDS = 25
MAX_DELAY_SECONDS = 60
PAGE_LOAD_WAIT = 35
QR_SCAN_WAIT = 90
# =================================================

def main():
    print("============================================================")
    print("   📱  WhatsApp Bulk Sender — Starting Up")
    print("============================================================")
    print(f"   📄  CSV File     : {CSV_FILE}")
    
    # Safely print a preview of the message
    msg_preview = MESSAGE.replace('\n', ' ')
    if len(msg_preview) > 30:
        msg_preview = msg_preview[:30] + "..."
    print(f"   📝  Message      : {msg_preview}")
    print(f"   ⏱️   Delay Range  : {MIN_DELAY_SECONDS}–{MAX_DELAY_SECONDS} seconds")
    print(f"   🔢  Max Messages : {MAX_MESSAGES_PER_SESSION}")
    print("============================================================\n")

    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    csv_path = os.path.join(current_dir, CSV_FILE)

    # 1. Check CSV File
    if not os.path.exists(csv_path):
        print(f"❌ Error: Could not find '{CSV_FILE}' in {current_dir}.")
        print("Please create it with a 'phone' column.")
        return

    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return

    # Normalize column names to lowercase to catch 'Phone', 'PHONE', etc.
    df.columns = df.columns.str.lower()

    if 'phone' not in df.columns:
        print("❌ Error: CSV must have a column named 'phone'")
        return

    # Clean phone numbers (remove spaces, +, dashes)
    df['phone'] = df['phone'].astype(str).str.replace(r'\D', '', regex=True)
    
    # Filter out empty strings or the literal string "null" often found in CSVs
    df = df[
        (df['phone'].str.strip() != '') & 
        (df['phone'].str.lower() != 'null')
    ]
    
    numbers = df['phone'].tolist()

    if len(numbers) == 0:
        print("❌ Error: No valid phone numbers found in CSV.")
        return

    # Look for previous sent files to prevent sending duplicate messages
    import glob
    sent_files = glob.glob(os.path.join(current_dir, "sent_*.txt"))
    already_sent = set()
    for s_file in sent_files:
        with open(s_file, "r", encoding="utf-8") as f:
            for line in f:
                already_sent.add(line.strip())
                
    if len(already_sent) > 0:
        print(f"🔄 Found {len(already_sent)} previously sent messages. Skipping them...")
        
    # Filter out the numbers we already sent to 
    numbers = [num for num in numbers if num not in already_sent]

    if len(numbers) == 0:
        print("✅ All contacts from the CSV have already been successfully messaged!")
        return

    print(f"✅ Loaded {len(numbers)} valid phone numbers from '{CSV_FILE}'")

    if len(numbers) > MAX_MESSAGES_PER_SESSION:
        print(f"⚠️ Limiting to {MAX_MESSAGES_PER_SESSION} messages for this session.")
        numbers = numbers[:MAX_MESSAGES_PER_SESSION]

    # 2. Setup Chrome Driver
    print("🔧 Setting up Chrome browser...")
    chrome_options = Options()
    
    # Profile directory to save session
    user_data_dir = os.path.join(current_dir, "chrome_profile")
    chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
    
    # Anti-automation detection flags
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    try:
        # webdriver-manager automatically handles downloading/updating chromedriver
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        print("✅ Chrome browser launched successfully.\n")
    except WebDriverException as e:
        print(f"❌ Error launching Chrome: {e}")
        print("Make sure you have Google Chrome installed and closed any existing instances using the same profile.")
        return
    except Exception as e:
        print(f"❌ Unexpected error setting up Chrome: {e}")
        return

    # 3. Open WhatsApp Web
    print("🌐 Opening WhatsApp Web...")
    driver.get("https://web.whatsapp.com")

    print("\n📱 SCAN THE QR CODE NOW IN YOUR CHROME WINDOW")
    print(f"⏳ You have {QR_SCAN_WAIT} seconds to scan or wait for loading if already logged in.")

    try:
        # Wait for either the search box or the 'new chat' icon to appear
        # These indicate successful login
        WebDriverWait(driver, QR_SCAN_WAIT).until(
            EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'] | //span[@data-icon='chat'] | //canvas"))
        )
        
        # Adding an extra wait to ensure all chats and backend data sync successfully
        print("✅ WhatsApp Web connected. Allowing 10 seconds for data sync...")
        time.sleep(10)
    except TimeoutException:
        print("\n❌ Timeout waiting for WhatsApp Web to load.")
        print("Either QR code wasn't scanned in time, or internet is too slow.")
        driver.quit()
        return

    # 4. Process Numbers
    print("\n✅ Starting to send messages...\n")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sent_file = os.path.join(current_dir, f"sent_{timestamp}.txt")
    failed_file = os.path.join(current_dir, f"failed_{timestamp}.txt")

    sent_count = 0
    failed_count = 0
    encoded_msg = urllib.parse.quote(MESSAGE)

    for idx, phone in enumerate(numbers, 1):
        print(f"  📞 Processing: +{phone} ({idx}/{len(numbers)})")
        
        url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"
        driver.get(url)

        try:
            # First, check if the "invalid number" popup appears or if the chat loads
            # We wait a short time for either the OK button (dialog) or the Send button
            is_invalid = False
            try:
                # Wait up to 10 seconds to see if the "Phone number shared via url is invalid." dialog shows up
                invalid_ok_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//div[@role='button']//div[contains(text(), 'OK')]"))
                )
                invalid_ok_btn.click()
                is_invalid = True
            except TimeoutException:
                pass # No invalid dialog appeared, meaning the chat is likely loading fine
                
            if is_invalid:
                current_time = datetime.now().strftime("%H:%M:%S")
                print(f"  [{current_time}] ❌ ({idx}/{len(numbers)}) {phone} — SKIPPED (Not registered on WhatsApp)")
                with open(failed_file, "a", encoding="utf-8") as f:
                    f.write(f"{phone} (Unregistered)\n")
                failed_count += 1
                continue # Skip to the next number immediately

            # If it's a valid number, wait for the actual send button to appear
            # WhatsApp Web UI changes often. Let's try multiple ways to find the send button.
            send_btn_xpaths = [
                "//span[@data-icon='send']",
                "//button[@aria-label='Send']",
                "//div[@role='button' and .//span[@data-icon='send']]"
            ]
            
            send_clicked = False
            for xpath in send_btn_xpaths:
                try:
                    send_button = WebDriverWait(driver, 15).until(
                        EC.element_to_be_clickable((By.XPATH, xpath))
                    )
                    send_button.click()
                    send_clicked = True
                    break
                except TimeoutException:
                    continue
            
            # If standard buttons fail, try pressing ENTER on the message box
            if not send_clicked:
                from selenium.webdriver.common.keys import Keys
                message_box = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'][@data-tab='10']"))
                )
                message_box.send_keys(Keys.ENTER)
            
            time.sleep(2) # Give it 2 seconds to actually send the message over the network
            
            current_time = datetime.now().strftime("%H:%M:%S")
            print(f"  [{current_time}] ✅ ({idx}/{len(numbers)}) {phone} — SENT")
            
            with open(sent_file, "a", encoding="utf-8") as f:
                f.write(f"{phone}\n")
            sent_count += 1
            
            # Delay before next message (except after the last one)
            if idx < len(numbers):
                delay = random.randint(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)
                print(f"  ⏳ Waiting {delay} seconds before next message...")
                time.sleep(delay)

        except TimeoutException:
            current_time = datetime.now().strftime("%H:%M:%S")
            print(f"  [{current_time}] ❌ ({idx}/{len(numbers)}) {phone} — FAILED (Timeout: Send button not found or invalid number)")
            with open(failed_file, "a", encoding="utf-8") as f:
                f.write(f"{phone}\n")
            failed_count += 1
        except Exception as e:
            current_time = datetime.now().strftime("%H:%M:%S")
            print(f"  [{current_time}] ❌ ({idx}/{len(numbers)}) {phone} — FAILED ({e})")
            with open(failed_file, "a", encoding="utf-8") as f:
                f.write(f"{phone}\n")
            failed_count += 1
            
    print("\n============================================================")
    print("   🏁 Finished Sending Setup completed.")
    print(f"   ✅ Sent   : {sent_count}")
    print(f"   ❌ Failed : {failed_count}")
    print("============================================================")
    print(f"Logs saved to:")
    print(f" - {sent_file}")
    print(f" - {failed_file}")
    
    # Close browser
    time.sleep(3)
    driver.quit()

if __name__ == "__main__":
    main()
