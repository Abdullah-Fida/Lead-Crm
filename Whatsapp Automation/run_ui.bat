@echo off
echo =======================================================
echo   WhatsApp Bulk Sender UI Initializer
echo =======================================================
echo Checking Python dependencies...
pip install -r requirements.txt
echo Starting Streamlit App...
python -m pip install -r requirements.txt
python -m streamlit run app.py
pause
