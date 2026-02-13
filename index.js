<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>⚙️ Admin Panel</title>
    <link rel="stylesheet" href="../style.css">
</head>
<body style="background:#050505; color:white; font-family:sans-serif;">
    <div id="login" style="text-align:center; padding-top: 100px;">
        <h2>🔐 ACCESO STAFF</h2>
        <input type="password" id="pass" style="padding:10px; border-radius:5px; border:none;">
        <button onclick="checkPass()" style="padding:10px; cursor:pointer;">ENTRAR</button>
    </div>

    <div id="panel" style="display:none; max-width:500px; margin:auto; padding-top:50px;">
        <h2 style="text-align:center;">⚙️ CONTROL DE SISTEMAS</h2>
        <div id="btn-container"></div>
    </div>

    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getFirestore, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAEUOzOWdq0xs3qiIlX1RzB6bpKkkMLykA",
            authDomain: "antifiltras-7116d.firebaseapp.com",
            projectId: "antifiltras-7116d",
            appId: "1:795745598666:web:72b77816d3c2a3c17f8833"
        };
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        window.checkPass = () => {
            if(document.getElementById('pass').value === 'Antifiltras2026') {
                document.getElementById('login').style.display = 'none';
                document.getElementById('panel').style.display = 'block';
            }
        };

        onSnapshot(doc(db, "BOT_CONTROL", "settings"), (s) => {
            const container = document.getElementById('btn-container');
            const d = s.data();
            container.innerHTML = `
                <button onclick="enviarAlerta()" style="width:100%; padding:15px; background:#ff3e3e; color:white; border:none; border-radius:5px; font-weight:bold; margin-bottom:20px; cursor:pointer;">📢 NOTIFICAR CAMBIOS EN DISCORD</button>
                ${renderBtn('🌐 WEB', 'webEnabled', d.webEnabled)}
                ${renderBtn('📩 TICKETS', 'ticketsEnabled', d.ticketsEnabled)}
                ${renderBtn('🚫 BANS', 'bansEnabled', d.bansEnabled)}
                ${renderBtn('⚙️ CONFIG', 'configEnabled', d.configEnabled)}
            `;
        });

        window.enviarAlerta = async () => { if(confirm("¿Mencionar al Staff?")) await updateDoc(doc(db, "BOT_CONTROL", "settings"), { forcePing: Date.now() }); };
        window.toggleFunc = async (f, v) => { await updateDoc(doc(db, "BOT_CONTROL", "settings"), { [f]: v === 1 ? 2 : (v === 2 ? 0 : 1) }); };
        function renderBtn(l, f, v) {
            let c = v === 1 ? '#00ff88' : (v === 2 ? '#ffcc00' : '#ff3e3e');
            let t = v === 1 ? 'OPERATIVO' : (v === 2 ? 'MANTENIMIENTO' : 'DESACTIVADO');
            return `<div style="display:flex; justify-content:space-between; margin-bottom:10px; background:#111; padding:15px; border-radius:5px;">
                <span>${l}</span>
                <button onclick="toggleFunc('${f}', ${v})" style="background:${c}; border:none; padding:5px 10px; border-radius:3px; font-weight:bold; cursor:pointer;">${t}</button>
            </div>`;
        }
    </script>
</body>
</html>
