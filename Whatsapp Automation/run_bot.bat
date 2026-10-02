@echo off
echo =========================================
echo Setting Up WhatsApp Bulk Sender
echo =========================================
echo.
echo Installing required Python libraries...
pip install selenium pandas webdriver-manager

echo.
echo Starting WhatsApp Bulk Sender Script...
python whatsapp_bulk_sender.py

pause
