"""Small stdlib-only CDP transport for our own temporary headless profile."""
import base64,hashlib,json,os,socket,struct,subprocess,time,urllib.request
from urllib.parse import urlsplit

class DevTools:
    def __init__(self,url):
        target=urlsplit(url)
        if target.scheme!='ws' or target.hostname not in ('127.0.0.1','localhost'):raise ValueError('调试地址不是本机')
        self.socket=socket.create_connection((target.hostname,target.port),timeout=3)
        self.serial=0;self.buffer=bytearray()
        key=base64.b64encode(os.urandom(16)).decode('ascii')
        request=f'GET {target.path} HTTP/1.1\r\nHost: {target.hostname}:{target.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
        self.socket.sendall(request.encode('ascii'))
        while b'\r\n\r\n' not in self.buffer:
            data=self.socket.recv(4096)
            if not data:self.socket.close();raise EOFError('离线浏览器调试握手中断')
            self.buffer.extend(data)
        header,remaining=self.buffer.split(b'\r\n\r\n',1);self.buffer=bytearray(remaining)
        expected=base64.b64encode(hashlib.sha1((key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
        if not header.startswith(b'HTTP/1.1 101') or expected not in header:
            self.socket.close();raise ValueError('本机浏览器调试连接失败')

    def read(self,length):
        while len(self.buffer)<length:
            data=self.socket.recv(max(4096,length-len(self.buffer)))
            if not data:raise EOFError('离线浏览器连接已关闭')
            self.buffer.extend(data)
        value=bytes(self.buffer[:length]);del self.buffer[:length];return value

    def send(self,payload,opcode=1):
        mask=os.urandom(4);length=len(payload)
        header=bytes([128|opcode,128|(length if length<126 else 126 if length<65536 else 127)])
        if length>=126:header+=struct.pack('!H' if length<65536 else '!Q',length)
        self.socket.sendall(header+mask+bytes(v^mask[i%4] for i,v in enumerate(payload)))

    def receive(self):
        pieces=[]
        while True:
            first,second=self.read(2);length=second&127
            if length==126:length=struct.unpack('!H',self.read(2))[0]
            elif length==127:length=struct.unpack('!Q',self.read(8))[0]
            if length>2_000_000:raise ValueError('离线验证结果过大')
            mask=self.read(4) if second&128 else None;data=self.read(length)
            if mask:data=bytes(v^mask[i%4] for i,v in enumerate(data))
            opcode=first&15
            if opcode==8:raise EOFError('离线浏览器连接已关闭')
            if opcode==9:self.send(data,10);continue
            if opcode==10:continue
            if opcode not in (0,1):raise ValueError('离线验证通信格式无效')
            pieces.append(data)
            if first&128:return json.loads(b''.join(pieces))

    def request(self,method,params=None):
        self.serial+=1;serial=self.serial
        self.send(json.dumps({'id':serial,'method':method,'params':params or {}}).encode())
        while True:
            response=self.receive()
            if response.get('id')!=serial:continue
            if 'error' in response:raise ValueError('离线浏览器调试调用失败：'+str(response['error'].get('message')))
            return response.get('result',{})

    def close(self):self.socket.close()

def render_result(browser,source,profile):
    command=[str(browser),'--headless=new','--disable-gpu','--disable-background-networking','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+str(profile),source.as_uri()]
    options={'stdout':subprocess.DEVNULL,'stderr':subprocess.DEVNULL}
    if os.name=='nt':options['creationflags']=subprocess.CREATE_NO_WINDOW
    process=subprocess.Popen(command,**options);connection=None;deadline=time.monotonic()+20
    try:
        active=profile/'DevToolsActivePort';port=None
        while time.monotonic()<deadline:
            if process.poll() is not None:raise ValueError('离线 Chrome 启动失败')
            if active.is_file():
                try:values=active.read_text().splitlines()
                except OSError:
                    time.sleep(.05)
                    continue
                if values and values[0].isdigit():port=int(values[0]);break
            time.sleep(.05)
        if not port:raise ValueError('离线 Chrome 启动超时')
        # No system proxy is used for this private localhost connection.
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        while time.monotonic()<deadline:
            try:
                with opener.open(f'http://127.0.0.1:{port}/json/list',timeout=3) as response:targets=json.load(response)
            except OSError:
                time.sleep(.05)
                continue
            target=next((target for target in targets if target.get('type')=='page' and target.get('url')==source.as_uri()),None)
            if target:connection=DevTools(target['webSocketDebuggerUrl']);break
            time.sleep(.05)
        if not connection:raise ValueError('离线验证页面没有就绪')
        while time.monotonic()<deadline:
            response=connection.request('Runtime.evaluate',{'expression':"document.getElementById('inspection-result')?.textContent",'returnByValue':True})
            value=response.get('result',{}).get('value')
            if value and value!='pending':return json.loads(value)
            time.sleep(.05)
        raise ValueError('原程序离线验证超时')
    finally:
        if connection:
            try:connection.request('Browser.close')
            except Exception:pass
            connection.close()
        try:process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            # Only the process started above and its descendants are terminated.
            if os.name=='nt':subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW,timeout=5)
            else:process.kill()
