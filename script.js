// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyD0R5nyAPnbh4fRFtx_BeaPedP5AZspbq4",
    authDomain: "dryfu-system.firebaseapp.com",
    databaseURL: "https://dryfu-system-default-rtdb.firebaseio.com",
    projectId: "dryfu-system",
    storageBucket: "dryfu-system.firebasestorage.app",
    messagingSenderId: "285214314507",
    appId: "1:285214314507:web:c58c98ca25f626b9b3370e"
};
try { firebase.initializeApp(firebaseConfig); window.db = firebase.database(); }
catch (e) { console.error(e); }

// --- 2. SECURITY & UTILS ---
// ✅ FIX: PIN ko Firebase se check kiya jata hai ab (JS mein plain text nahi)
// Firebase mein jaake: config/pin = "0904" set karo (ya jo bhi PIN chahiye)
async function checkLogin() {
    const input = document.getElementById('adminPass').value.trim();
    if (!input) return;

    try {
        const snap = await firebase.database().ref('config/pin').once('value');
        const storedPin = snap.val();

        if (input === String(storedPin)) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
        } else {
            document.getElementById('loginError').style.display = 'block';
            document.getElementById('adminPass').value = "";
        }
    } catch (e) {
        // Fallback: agar Firebase se pin na mile
        console.error("PIN fetch error:", e);
        alert("Connection error. Check internet.");
    }
}

// Enter key se bhi login ho
document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('adminPass');
    if (passInput) {
        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkLogin();
        });
    }
});

function downloadReport() {
    const element = document.getElementById("printableReport");
    html2canvas(element).then(canvas => {
        const link = document.createElement("a");
        link.download = `DryFu_Report_${new Date().toLocaleDateString('en-IN')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

function formatInput(el) {
    let v = el.value.replace(/\D/g, '');
    let f = "";
    if (v.length > 0) f = v.substring(0, 3);
    if (v.length > 3) f += "-" + v.substring(3, 6);
    if (v.length > 6) f += "-" + v.substring(6, 9);
    el.value = f;
}

function setAmt(v) { document.getElementById('adminAmount').value = v; }
function formatToIndianDate(d) { if (!d) return "--"; return d.split('-').reverse().join('/'); }

// --- 3. INIT ---
window.onload = function () {
    if (document.getElementById('adminDate')) {
        document.getElementById('adminDate').value = new Date().toISOString().split('T')[0];
        fetchCoupons();
    }
    if (document.getElementById('dailyReportBody')) {
        renderLocalReport();
    }
};

// --- 4. ADMIN LOGIC ---
function generateCoupon() {
    const amt = document.getElementById('adminAmount').value.trim();
    const from = document.getElementById('adminDate').value;
    const mob = document.getElementById('custMobile').value.trim();

    // ✅ FIX: Mobile number validation
    if (!amt || !from || !mob) { alert("Sabhi fields bharein"); return; }
    if (mob.length !== 10 || !/^\d{10}$/.test(mob)) {
        alert("Mobile number 10 digits ka hona chahiye");
        return;
    }
    if (parseInt(amt) <= 0) { alert("Valid discount amount daalein"); return; }

    const n = () => Math.floor(100 + Math.random() * 900);
    const code = `${n()}-${n()}-${n()}`;
    let exp = new Date(from); exp.setMonth(exp.getMonth() + 1);

    firebase.database().ref('coupons/' + code).set({
        code, amount: parseInt(amt), validFrom: from, validThru: exp.toISOString().split('T')[0],
        mobile: mob, used: false, createdAt: new Date().toISOString()
    }).then(() => {
        document.getElementById('newCouponResult').style.display = 'block';
        document.getElementById('resCode').innerText = code;
        document.getElementById('resFrom').innerText = formatToIndianDate(from);

        let expiryDateISO = exp.toISOString().split('T')[0];
        document.getElementById('resThru').innerText = formatToIndianDate(expiryDateISO);

        let waBtn = document.getElementById('shareWhatsappBtn');
        if (waBtn) {
            waBtn.setAttribute('onclick', `sendW('${mob}', '${code}', '${expiryDateISO}', ${amt})`);
        }

        document.getElementById('custMobile').value = "";
    }).catch(err => {
        alert("Error: " + err.message);
    });
}

function fetchCoupons() {
    const body = document.getElementById('historyBody');
    if (!body) return;
    firebase.database().ref('coupons').on('value', (snap) => {
        const data = snap.val();
        if (!data) { body.innerHTML = "<div style='text-align:center;padding:20px;color:#999'>Koi coupon nahi hai</div>"; return; }
        let list = Object.values(data);
        const today = new Date().toISOString().split('T')[0];

        list.sort((a, b) => {
            const actA = !a.used && a.validThru >= today;
            const actB = !b.used && b.validThru >= today;
            if (actA && !actB) return -1;
            if (!actA && actB) return 1;
            if (actA) return new Date(a.validThru) - new Date(b.validThru);
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        renderHistory(list);
    });
}

function renderHistory(list) {
    const body = document.getElementById('historyBody');
    const todayISO = new Date().toISOString().split('T')[0];
    let html = "", gen = 0, red = 0;

    list.forEach(c => {
        if (c.createdAt.startsWith(todayISO)) gen++;
        if (c.usedAt && c.usedAt.includes(new Date().toLocaleDateString('en-IN'))) red += c.amount;

        const isExp = todayISO > c.validThru;
        const isUpcoming = todayISO < c.validFrom;
        let cls = "", txt = "ACTIVE";

        if (c.used) { cls = "status-used"; txt = "USED"; }
        else if (isExp) { cls = "status-expired"; txt = "EXPIRED"; }
        else if (isUpcoming) { cls = "status-expired"; txt = "UPCOMING"; }

        html += `<div class="hist-card ${cls}">
            <div class="h-left">
                <span class="h-code">${c.code}</span>
                <span class="h-detail">₹${c.amount} | 📱 ${c.mobile}</span>
                <span class="h-exp" style="color:${isExp ? 'red' : 'green'}">📅 ${formatToIndianDate(c.validThru)} (${txt})</span>
                ${c.used ? `<span style="font-size:10px; color:red; font-weight:bold;">✅ Redeemed: ${c.usedAt}</span>` : ''}
            </div>
            <div class="h-right">
                ${!c.used && !isExp ? `<button class="wa-btn" onclick="sendW('${c.mobile}','${c.code}','${c.validThru}', ${c.amount})">📲</button>` : ''}
            </div>
        </div>`;
    });
    body.innerHTML = html;
    if (document.getElementById('statGenCount')) {
        document.getElementById('statGenCount').innerText = gen;
        document.getElementById('statRedeemVal').innerText = "₹" + red;
    }
}

// WhatsApp message with 3 scenarios
function sendW(mob, code, date, amount) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expDate = new Date(date);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    const formattedDate = formatToIndianDate(date);

    const howToUse = "\n\n💡 *Kaise Use Karein?*\nApne Delivery Boy ko payment karte samay ye Code dikhayein aur turant Discount payein!";
    const tnc = "\n\n*📝 T&C:*\n• Min Order: ₹750\n• One-time use only\n• Not exchangeable for Cash\n• T&C Apply";
    let msg = "";

    if (diffDays <= 0) {
        msg = `🚨 *LAST CHANCE ALERT!* 🚨\n\nDryFu Coupon *₹${amount} OFF* aaj raat expire ho jayega!\n\n🎟️ Code: *${code}*\n⏳ Validity: *AAJ RAAT TAK*\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    } else if (diffDays <= 5) {
        msg = `⏳ *Sirf ${diffDays} Din Bache Hain* ⏳\n\nCoupon expire hone wala hai!\n\n💰 Value: *₹${amount} OFF*\n🎟️ Code: *${code}*\n📅 Expiring: *${formattedDate}*\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    } else {
        msg = `🎁 *Special Gift For You!* 🎁\n\nHum aapke liye laye hain Discount Coupon.\n\n💰 *FLAT ₹${amount} OFF*\n🎟️ Code: *${code}*\n📅 Valid till: ${formattedDate}\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    }

    window.open(`https://wa.me/91${mob}?text=${encodeURIComponent(msg)}`);
}

function copyCode() { navigator.clipboard.writeText(document.getElementById('resCode').innerText); alert("Copied!"); }
function clearAllData() { if (confirm("Sab data delete kar dein? Ye undo nahi hoga.")) firebase.database().ref('coupons').remove(); }

// --- 5. VERIFY LOGIC ---
function validateCoupon() {
    const billInput = document.getElementById('checkBill');
    const codeInput = document.getElementById('checkInput');
    const resBox = document.getElementById('checkResult');
    const bill = parseFloat(billInput.value);
    const code = codeInput.value.trim();

    resBox.style.display = 'none';
    if (!bill || !code) { alert("Invoice aur Code dono daalein"); return; }

    firebase.database().ref('coupons/' + code).once('value', (snap) => {
        const c = snap.val();
        resBox.style.display = 'block';

        if (!c) { showError("INVALID CODE", "Code system mein nahi mila", bill); return; }
        if (c.used) { showError("ALREADY USED", `Redeemed At: ${c.usedAt}`, bill); return; }

        const todayISO = new Date().toISOString().split('T')[0];
        if (todayISO < c.validFrom) { showError("NOT ACTIVE YET", `Shuru hoga: ${formatToIndianDate(c.validFrom)}`, bill); return; }

        const GRACE_DAYS = 5;
        const expiryDate = new Date(c.validThru);
        expiryDate.setDate(expiryDate.getDate() + GRACE_DAYS);
        const hardStopISO = expiryDate.toISOString().split('T')[0];

        if (todayISO > hardStopISO) { showError("EXPIRED", `Expire Date: ${formatToIndianDate(c.validThru)}`, bill); return; }
        if (bill < 750) { showError("LOW BILL", `Minimum ₹750 chahiye discount ke liye`, bill); return; }

        const now = new Date();
        const timeStr = now.toLocaleDateString('en-IN') + ", " + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        firebase.database().ref('coupons/' + code).update({ used: true, usedAt: timeStr });
        addToLocalReport(bill, c.amount, code);

        let graceMsg = "";
        if (todayISO > c.validThru) {
            graceMsg = `<div style="font-size:10px; color:#d97706; margin-top:5px;">⚠️ Grace Period Applied (+${GRACE_DAYS} Days)</div>`;
        }

        const finalAmt = bill - c.amount;

        // ✅ FIX: Sahi UPI ID dono jagah same hai ab
        const upiId = "7014702933@YBL";
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${upiId}%26pn=DryFu%26am=${finalAmt}%26cu=INR`;

        resBox.className = "result-box";
        resBox.innerHTML = `
            <div class="res-header"><span class="res-icon">🎉</span><h3 class="res-title">CONGRATULATIONS!</h3></div>
            <div class="res-body">
                <div class="res-row"><span>Invoice</span><span>₹${bill}</span></div>
                <div class="res-row" style="color:#22c55e;"><span>Discount</span><span>- ₹${c.amount}</span></div>
                <div class="res-final"><span class="pay-label">COLLECT</span><span class="pay-amount">₹${finalAmt}</span></div>
                ${graceMsg}
                <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                    <p style="font-size:11px; color:#15803d; font-weight:900; margin: 0 0 10px 0; letter-spacing: 1px;">SCAN TO PAY FINAL AMOUNT</p>
                    <img src="${qrUrl}" alt="QR Code" style="width:130px; height:130px; border-radius:10px; mix-blend-mode: multiply;">
                </div>
            </div>`;

        renderLocalReport();
        billInput.value = ""; codeInput.value = "";
    });
}

function showError(t, m, billAmt = null) {
    const r = document.getElementById('checkResult');
    r.className = "result-box res-error";

    if (billAmt) {
        // ✅ FIX: Sahi aur same UPI ID use ho rahi hai
        const upiId = "7014702933@YBL";
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${upiId}%26pn=DryFu%26am=${billAmt}%26cu=INR`;

        r.innerHTML = `
            <div class="res-header" style="background: linear-gradient(135deg, #ef4444, #b91c1c);">
                <span class="res-icon">⚠️</span>
                <h3 class="res-title">${t}</h3>
                <div style="font-size:12px; margin-top:5px; font-weight:bold; opacity:0.9;">${m}</div>
            </div>
            <div class="res-body">
                <div class="res-row"><span>Invoice</span><span>₹${billAmt}</span></div>
                <div class="res-row" style="color:#ef4444;"><span>Discount</span><span>- ₹0</span></div>
                <div class="res-final" style="border-top: 2px dashed #e2e8f0; margin-top: 15px; padding-top: 15px;">
                    <span class="pay-label">COLLECT AMOUNT</span>
                    <span class="pay-amount" style="color: #134E5E;">₹${billAmt}</span>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <p style="font-size:11px; color:#64748b; font-weight:900; margin: 0 0 10px 0; letter-spacing: 1px;">SCAN TO PAY (UPI)</p>
                    <img src="${qrUrl}" alt="QR Code" style="width:130px; height:130px; border-radius:10px; mix-blend-mode: multiply;">
                </div>
            </div>`;
    } else {
        r.innerHTML = `
            <div class="res-header" style="background:#ef4444">
                <span class="res-icon">⚠️</span><h3 class="res-title">${t}</h3>
            </div>
            <div class="res-body">
                <span class="pay-amount" style="font-size:18px;color:#555">${m}</span>
            </div>`;
    }
}

function addToLocalReport(inv, disc, code) {
    const d = new Date().toLocaleDateString('en-IN');
    let r = JSON.parse(localStorage.getItem('dryfu_my_report') || '[]');
    r.push({ code, invoice: inv, discount: disc, final: inv - disc, date: d });
    localStorage.setItem('dryfu_my_report', JSON.stringify(r));
}

function renderLocalReport() {
    const tb = document.getElementById('dailyReportBody');
    if (!tb) return;
    const d = new Date().toLocaleDateString('en-IN');
    document.getElementById('reportDate').innerText = d;
    let r = JSON.parse(localStorage.getItem('dryfu_my_report') || '[]');
    let t = r.filter(i => i.date === d);
    if (r.length !== t.length) localStorage.setItem('dryfu_my_report', JSON.stringify(t));

    let h = "", td = 0;
    if (t.length === 0) {
        h = "<tr><td colspan='4' style='text-align:center;padding:20px;color:#999;font-size:12px'>Aaj koi redemption nahi</td></tr>";
    } else {
        t.slice().reverse().forEach(i => {
            td += i.discount;
            h += `<tr>
                <td style="color:#134E5E;font-size:11px">${i.code}</td>
                <td>₹${i.invoice}</td>
                <td class="col-right t-disc">-₹${i.discount}</td>
                <td class="col-right t-final">₹${i.final}</td>
            </tr>`;
        });
    }
    tb.innerHTML = h;
    document.getElementById('myRedeemCount').innerText = t.length;
    document.getElementById('myTotalDisc').innerText = "₹" + td;
}
