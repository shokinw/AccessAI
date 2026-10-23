python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000


Frontend: http://127.0.0.1:5500/frontend/index.html



Backend health: http://127.0.0.1:8000/health

cloudflared tunnel --url http://localhost:5500


IN mobile
first connet with the hptspot then
in temrinal ruun backend    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
thenn see the ipconfig IPv4 address.
then in mobile see these link http://10.52.104.127:8000/health
and this one http://10.52.104.127:8000/docs 
http://10.52.104.127:5500/frontend/index.html



cloudflar"""  cloudflared tunnel --url http://localhost:5500
