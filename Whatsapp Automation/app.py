import streamlit as st
import pandas as pd
import os
import time
import random
import urllib.parse
import re
from datetime import datetime
import glob
from pathlib import Path

# Selenium imports
from selenium import webdriver
from selenium.webdriver.safari.service import Service as SafariService
from selenium.webdriver.safari.options import Options as SafariOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.keys import Keys

# Setup page config
st.set_page_config(page_title="WhatsApp Bulk Sender", page_icon="📱", layout="wide")

def get_already_sent_numbers(current_dir):
    sent_files = glob.glob(os.path.join(current_dir, "sent_*.txt"))
    already_sent = set()
    for s_file in sent_files:
        with open(s_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    already_sent.add(line.strip())
    return already_sent

def init_driver(user_data_dir):
    safari_options = SafariOptions()
    driver = webdriver.Safari(options=safari_options)
    return driver

def send_messages(records, message_template, min_delay, max_delay, pause_every, pause_duration, current_dir):
    user_data_dir = os.path.join(current_dir, "chrome_profile")
    
    yield {"status": "info", "message": "Starting Chrome browser..."}
    try:
        driver = init_driver(user_data_dir)
        yield {"status": "success", "message": "Chrome launched successfully."}
    except Exception as e:
        yield {"status": "error", "message": f"Error launching Chrome: {e}\nEnsure Chrome is installed and all existing profiles are closed."}
        return

    try:
        yield {"status": "info", "message": "🌐 Opening WhatsApp Web... Please scan QR code if prompted."}
        driver.get("https://web.whatsapp.com")
        
        try:
            WebDriverWait(driver, 90).until(
                EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'] | //span[@data-icon='chat'] | //canvas"))
            )
            yield {"status": "info", "message": "Waiting 10 seconds for chats to sync..."}
            time.sleep(10)
            yield {"status": "success", "message": "WhatsApp Web connected successfully."}
        except TimeoutException:
            yield {"status": "error", "message": "Timeout waiting for WhatsApp Web to load. QR code not scanned or internet too slow."}
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        sent_file = os.path.join(current_dir, f"sent_{timestamp}.txt")
        failed_file = os.path.join(current_dir, f"failed_{timestamp}.txt")

        sent_count = 0
        failed_count = 0
        total = len(records)

        for idx, record in enumerate(records, 1):
            phone = record['phone']
            
            # Personalize message using record columns
            personalized_msg = message_template
            for key, value in record.items():
                if pd.isna(value):
                    value = ""
                pattern = re.compile(re.escape(f"{{{key}}}"), re.IGNORECASE)
                personalized_msg = pattern.sub(str(value), personalized_msg)
                
            encoded_msg = urllib.parse.quote(personalized_msg)
            
            yield {"status": "progress", "message": f"📞 Processing: +{phone}...", "current": idx, "total": total}
            
            url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"
            driver.get(url)

            try:
                is_invalid = False
                try:
                    invalid_ok_btn = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((By.XPATH, "//div[@role='button']//div[contains(text(), 'OK')]"))
                    )
                    invalid_ok_btn.click()
                    is_invalid = True
                except TimeoutException:
                    pass 
                    
                if is_invalid:
                    with open(failed_file, "a", encoding="utf-8") as f:
                        f.write(f"{phone} (Unregistered)\n")
                    failed_count += 1
                    yield {"status": "warning", "message": f"❌ {phone} — SKIPPED (Not registered on WhatsApp)", "sent": sent_count, "failed": failed_count, "report": {"Phone": phone, "Status": "Unregistered"}}
                    continue 

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
                
                if not send_clicked:
                    message_box = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'][@data-tab='10']"))
                    )
                    message_box.send_keys(Keys.ENTER)
                
                time.sleep(2) 
                
                with open(sent_file, "a", encoding="utf-8") as f:
                    f.write(f"{phone}\n")
                sent_count += 1
                yield {"status": "success", "message": f"✅ {phone} — SENT", "sent": sent_count, "failed": failed_count, "report": {"Phone": phone, "Status": "Sent"}}
                
                if idx < total:
                    if idx % pause_every == 0:
                        pause_sec = pause_duration * 60
                        yield {"status": "delay", "message": f"⏸️ Smart Pause! Resting for {pause_duration} minutes...", "delay": pause_sec}
                        time.sleep(pause_sec)
                    else:
                        delay = random.randint(min_delay, max_delay)
                        yield {"status": "delay", "message": f"⏳ Waiting {delay} seconds...", "delay": delay}
                        time.sleep(delay)

            except Exception as e:
                with open(failed_file, "a", encoding="utf-8") as f:
                    f.write(f"{phone}\n")
                failed_count += 1
                yield {"status": "error_item", "message": f"❌ {phone} — FAILED ({str(e)})", "sent": sent_count, "failed": failed_count, "report": {"Phone": phone, "Status": f"Failed: {str(e)}"}}
                
        yield {"status": "done", "message": f"🏁 Finished! Sent: {sent_count}, Failed: {failed_count}"}
        time.sleep(3)
    finally:
        try:
            driver.quit()
        except:
            pass

def main():
    st.title("📱 WhatsApp Bulk Sender GUI")
    
    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    already_sent = get_already_sent_numbers(current_dir)

    # Sidebar parameters
    st.sidebar.header("⚙️ Configuration")
    
    default_msg = """Salam. Badar here. I noticed something about your 
clinic's online presence and had an idea that could 
bring more patient inquiries. If you're open, I can share it."""

    message = st.sidebar.text_area("Message to Send", value=default_msg, height=200)
    
    st.sidebar.subheader("Delay Settings")
    min_delay = st.sidebar.number_input("Minimum Delay (seconds)", min_value=1, value=8)
    max_delay = st.sidebar.number_input("Maximum Delay (seconds)", min_value=1, value=15)
    
    st.sidebar.subheader("Smart Pausing")
    pause_every = st.sidebar.number_input("Pause after X messages", min_value=1, value=50)
    pause_duration = st.sidebar.number_input("Pause duration (minutes)", min_value=1, value=5)
    
    st.sidebar.subheader("Batch Processing")

    # File upload
    st.subheader("1. Upload Contacts")
    uploaded_file = st.file_uploader("Upload CSV file", type=["csv"])
    
    if uploaded_file is not None:
        try:
            df = pd.read_csv(uploaded_file)
            df.columns = df.columns.str.lower()
            
            if 'phone' not in df.columns:
                st.error("❌ CSV must have a column named 'phone'")
                return
                
            df['phone'] = df['phone'].astype(str).str.replace(r'\D', '', regex=True)
            df = df[(df['phone'].str.strip() != '') & (df['phone'].str.lower() != 'null')]
            
            # Remove duplicate phone numbers to prevent sending multiple messages
            df = df.drop_duplicates(subset=['phone'])
            
            all_records = df.to_dict('records')
            
            if not all_records:
                st.error("❌ No valid phone numbers found in CSV.")
                return
                
            st.success(f"✅ Found {len(all_records)} valid unique phone numbers in total.")
            
            st.info("💡 Tip: You can personalize messages! Use `{column_name}` in your message text.", icon="ℹ️")
            available_vars = ", ".join([f"{{{col}}}" for col in df.columns if col != 'phone'])
            if available_vars:
                st.code(f"Available variables: {available_vars}")
            
            # --- Explicit Row Selection ---
            st.subheader("2. Select Batch Range")
            st.write("Choose exactly which rows from the CSV you want to process in this session.")
            
            row_col1, row_col2 = st.columns(2)
            with row_col1:
                start_row = st.number_input("Start Row (e.g. 1)", min_value=1, max_value=len(all_records), value=1)
            with row_col2:
                default_end = min(start_row + 49, len(all_records))
                end_row = st.number_input("End Row (e.g. 50)", min_value=start_row, max_value=len(all_records), value=default_end)
                
            selected_records = all_records[start_row - 1 : end_row]
            
            st.write("---")
            
            # Filter already sent (only from the selected range)
            remaining_records = [rec for rec in selected_records if rec['phone'] not in already_sent]
            
            st.write(f"📊 **Statistics for Row {start_row} to {end_row}:**")
            st.write(f"- Numbers in selected range: {len(selected_records)}")
            st.write(f"- Already sent in this range: {len(selected_records) - len(remaining_records)} (skipped automatically)")
            st.write(f"- **Will send to:** {len(remaining_records)}")
            
            if not remaining_records:
                st.warning(f"⚠️ All contacts in range {start_row}-{end_row} have already been messaged!")
                return
                
            records_to_send = remaining_records
            
            with st.expander("Preview Numbers to Send"):
                st.dataframe(pd.DataFrame(records_to_send))
                
            st.subheader("3. Start Automation")
            
            if st.button("🚀 Start Sending", use_container_width=True, type="primary"):
                if "sending" not in st.session_state:
                    st.session_state.sending = True
                    
                st.write("---")
                status_container = st.empty()
                progress_bar = st.progress(0)
                log_container = st.container()
                
                with log_container:
                    st.write("📝 **Execution Logs:**")
                    logs = []
                    log_col = st.empty()
                
                metrics_col1, metrics_col2 = st.columns(2)
                success_metric = metrics_col1.metric("Sent", 0)
                failed_metric = metrics_col2.metric("Failed", 0)
                
                # Run generator
                final_report_data = []
                for step in send_messages(records_to_send, message, min_delay, max_delay, pause_every, pause_duration, current_dir):
                    status = step["status"]
                    msg = step["message"]
                    
                    if "report" in step:
                        final_report_data.append(step["report"])
                    
                    if status == "info":
                        status_container.info(msg)
                        logs.append(msg)
                    elif status == "progress":
                        status_container.info(msg)
                        logs.append(msg)
                        progress = step["current"] / step["total"]
                        progress_bar.progress(progress)
                    elif status == "success" or status == "warning" or status == "error_item":
                        if "—" in msg:
                            logs.append(msg)
                            success_metric.metric("Sent", step.get("sent", 0))
                            failed_metric.metric("Failed", step.get("failed", 0))
                        else:
                            status_container.success(msg)
                            logs.append(msg)
                    elif status == "delay":
                        status_container.warning(msg)
                        logs.append(msg)
                    elif status == "error":
                        status_container.error(msg)
                        logs.append(msg)
                    elif status == "done":
                        status_container.success(msg)
                        logs.append(msg)
                        progress_bar.progress(1.0)
                        st.balloons()
                        
                        if final_report_data:
                            st.write("### 📊 Final Report")
                            report_df = pd.DataFrame(final_report_data)
                            st.dataframe(report_df)
                            csv_data = report_df.to_csv(index=False).encode('utf-8')
                            st.download_button(
                                label="Download Report as CSV",
                                data=csv_data,
                                file_name=f"whatsapp_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                                mime="text/csv"
                            )
                        
                    # Update logs UI
                    log_text = "\n".join([f"> {l}" for l in logs[-10:]]) # show last 10 logs
                    log_col.markdown(f"```text\n{log_text}\n```")
                    
        except Exception as e:
            st.error(f"Error reading CSV: {e}")

if __name__ == "__main__":
    main()
