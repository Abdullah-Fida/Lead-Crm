import os
import time
import random
import urllib.parse
import threading
from datetime import datetime

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    webdriver = None


class WhatsAppEngine:
    def __init__(self, state_ref):
        self.state = state_ref
        self.driver = None
        self.running = False
        self.thread = None

    def _log(self, text, status="info"):
        self.state["logs"].append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "status": status,
            "message_preview": text
        })
        print(f"[WhatsApp] {text}")

    def start_worker(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def _worker_loop(self):
        if not webdriver:
            self._log("Selenium is not installed. Cannot start WhatsApp Engine.", "error")
            self.running = False
            return

        self._log("Starting WhatsApp Engine...", "info")
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        chrome_options = Options()
        user_data_dir = os.path.join(current_dir, "chrome_profile")
        chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        try:
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self._log("Chrome browser launched.", "info")
        except Exception as e:
            self._log(f"Failed to launch Chrome: {e}", "error")
            self.running = False
            return

        self._log("Opening WhatsApp Web. Please scan QR if needed...", "info")
        try:
            self.driver.get("https://web.whatsapp.com")
            
            # Wait up to 60s for login (QR scan)
            WebDriverWait(self.driver, 60).until(
                EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'] | //span[@data-icon='chat'] | //canvas"))
            )
            self._log("WhatsApp connected! Waiting for chats to sync...", "success")
            time.sleep(5)
        except TimeoutException:
            self._log("Timeout waiting for WhatsApp Web to load or QR to be scanned.", "error")
            self.driver.quit()
            self.running = False
            return
        except Exception as e:
            self._log(f"Error opening WhatsApp Web: {e}", "error")
            self.driver.quit()
            self.running = False
            return

        # Main processing loop
        while self.running:
            if not self.state["queue"]:
                time.sleep(2)
                continue
                
            # Pop the first item
            job = self.state["queue"].pop(0)
            phone = job.get("phone", "")
            message = job.get("message", "")
            
            if not phone or not message:
                continue
                
            if self.state["sent_today"] >= self.state["daily_limit"]:
                self._log("Daily limit reached. Pausing.", "warning")
                self.state["queue"].insert(0, job) # Put it back
                time.sleep(10)
                continue

            self._send_message(phone, message)
            
            # Delay between messages
            if self.state["queue"]:
                delay = random.randint(self.state["min_delay"], self.state["max_delay"])
                self._log(f"Waiting {delay}s before next message...", "info")
                time.sleep(delay)

        self.driver.quit()
        self._log("WhatsApp Engine stopped.", "info")

    def _send_message(self, phone, message):
        self._log(f"Sending to {phone}...", "info")
        encoded_msg = urllib.parse.quote(message)
        url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"
        
        try:
            self.driver.get(url)
            
            # Check for invalid number dialog
            try:
                invalid_ok_btn = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//div[@role='button']//div[contains(text(), 'OK')]"))
                )
                invalid_ok_btn.click()
                self._log(f"Skipped {phone} (Not registered on WhatsApp)", "error")
                return
            except TimeoutException:
                pass
                
            # Wait for send button
            send_btn_xpaths = [
                "//span[@data-icon='send']",
                "//button[@aria-label='Send']",
                "//div[@role='button' and .//span[@data-icon='send']]"
            ]
            
            send_clicked = False
            for xpath in send_btn_xpaths:
                try:
                    send_button = WebDriverWait(self.driver, 15).until(
                        EC.element_to_be_clickable((By.XPATH, xpath))
                    )
                    send_button.click()
                    send_clicked = True
                    break
                except TimeoutException:
                    continue
                    
            if not send_clicked:
                from selenium.webdriver.common.keys import Keys
                message_box = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'][@data-tab='10']"))
                )
                message_box.send_keys(Keys.ENTER)
                
            time.sleep(2)
            self.state["sent_today"] += 1
            self._log(f"Sent successfully to {phone}", "success")
            
        except Exception as e:
            self._log(f"Failed to send to {phone}: {str(e)[:50]}", "error")

    def stop(self):
        self.running = False
