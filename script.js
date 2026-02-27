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
const ADMIN_PIN = "0904";

function checkLogin() {
    const input = document.getElementById('adminPass').value;
    if (input === ADMIN_PIN) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('adminPass').value = "";
    }
}

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
    const amt = document.getElementById('adminAmount').value;
    const from = document.getElementById('adminDate').value;
    const mob = document.getElementById('custMobile').value;
    if (!amt || !from || !mob) { alert("Fill details"); return; }

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
        document.getElementById('resThru').innerText = formatToIndianDate(exp.toISOString().split('T')[0]);
        document.getElementById('custMobile').value = "";
    });
}

function fetchCoupons() {
    const body = document.getElementById('historyBody');
    if (!body) return;
    firebase.database().ref('coupons').on('value', (snap) => {
        const data = snap.val();
        if (!data) { body.innerHTML = "<div style='text-align:center'>No Data</div>"; return; }
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

// *** UPDATED: renderHistory ab Amount bhi pass karega ***
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

// *** // *** UPDATED WHATSAPP LOGIC: With "How to Use" Instructions ***
function sendW(mob, code, date, amount) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expDate = new Date(date);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    const formattedDate = formatToIndianDate(date);

    // 1. KAISE USE KAREIN (Instructions)
    const howToUse = "\n\n💡 *Kaise Use Karein?*\nApne Delivery Boy ko payment karte samay ye Code dikhayein aur turant Discount payein!";

    // --- TERMS AND CONDITIONS (Short Version) ---
    const tnc = "\n\n*📝 T&C:*\n• Min Order: ₹750\n• One-time use only\n• Not exchangeable for Cash\n• T&C Apply";
    let msg = "";

    if (diffDays <= 0) {
        // SCENARIO 1: AAJ LAST DAY
        msg = `🚨 *LAST CHANCE ALERT!* 🚨\n\nDryFu Coupon *₹${amount} OFF* aaj raat expire ho jayega!\n\n🎟️ Code: *${code}*\n⏳ Validity: *AAJ RAAT TAK*\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    }
    else if (diffDays <= 5) {
        // SCENARIO 2: WARNING
        msg = `⏳ *Sirf ${diffDays} Din Bache Hain* ⏳\n\nCoupon expire hone wala hai!\n\n💰 Value: *₹${amount} OFF*\n🎟️ Code: *${code}*\n📅 Expiring: *${formattedDate}*\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    }
    else {
        // SCENARIO 3: WELCOME
        msg = `🎁 *Special Gift For You!* 🎁\n\nHum aapke liye laye hain Discount Coupon.\n\n💰 *FLAT ₹${amount} OFF*\n🎟️ Code: *${code}*\n📅 Valid till: ${formattedDate}\n${howToUse}\n👉 Order: www.dryfu.com${tnc}`;
    }

    window.open(`https://wa.me/91${mob}?text=${encodeURIComponent(msg)}`);
}
function copyCode() { navigator.clipboard.writeText(document.getElementById('resCode').innerText); alert("Copied!"); }
function clearAllData() { if (confirm("Clear All?")) firebase.database().ref('coupons').remove(); }


// --- 5. CHECK PANEL ---
function validateCoupon() {
    const billInput = document.getElementById('checkBill');
    const codeInput = document.getElementById('checkInput');
    const resBox = document.getElementById('checkResult');
    const bill = parseFloat(billInput.value);
    const code = codeInput.value;

    resBox.style.display = 'none';
    if (!bill || !code) { alert("Enter details"); return; }

    firebase.database().ref('coupons/' + code).once('value', (snap) => {
        const c = snap.val();
        resBox.style.display = 'block';

        if (!c) { showError("INVALID", "Code not found"); return; }
        if (c.used) { showError("USED", `At: ${c.usedAt}`); return; }

        const todayISO = new Date().toISOString().split('T')[0];
        if (todayISO < c.validFrom) { showError("NOT ACTIVE", `Starts: ${formatToIndianDate(c.validFrom)}`); return; }

        // Grace Period Logic
        const GRACE_DAYS = 5;
        const expiryDate = new Date(c.validThru);
        expiryDate.setDate(expiryDate.getDate() + GRACE_DAYS);
        const hardStopISO = expiryDate.toISOString().split('T')[0];

        if (todayISO > hardStopISO) { showError("EXPIRED", `Date: ${formatToIndianDate(c.validThru)}`); return; }
        if (bill < 750) { showError("LOW BILL", `Min ₹750 req`); return; }

        const now = new Date();
        const timeStr = now.toLocaleDateString('en-IN') + ", " + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        firebase.database().ref('coupons/' + code).update({ used: true, usedAt: timeStr });
        addToLocalReport(bill, c.amount, code);

        let graceMsg = "";
        if (todayISO > c.validThru) {
            graceMsg = `<div style="font-size:10px; color:#d97706; margin-top:5px;">⚠️ Grace Period Applied (+${GRACE_DAYS} Days)</div>`;
        }

        resBox.className = "result-box";
        resBox.innerHTML = `
            <div class="res-header"><span class="res-icon">🎉</span><h3 class="res-title">CONGRATULATIONS!</h3></div>
            <div class="res-body">
                <div class="res-row"><span>Invoice</span><span>₹${bill}</span></div>
                <div class="res-row" style="color:#22c55e;"><span>Discount</span><span>- ₹${c.amount}</span></div>
                <div class="res-final"><span class="pay-label">COLLECT</span><span class="pay-amount">₹${bill - c.amount}</span></div>
                ${graceMsg}
            </div>`;
        renderLocalReport();
        billInput.value = ""; codeInput.value = "";
    });
}

function showError(t, m) {
    const r = document.getElementById('checkResult');
    r.className = "result-box res-error";
    r.innerHTML = `<div class="res-header" style="background:#ef4444"><span class="res-icon">⚠️</span><h3 class="res-title">${t}</h3></div><div class="res-body"><span class="pay-amount" style="font-size:18px;color:#555">${m}</span></div>`;
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
    if (t.length === 0) h = "<tr><td colspan='4' style='text-align:center;padding:20px;color:#999;font-size:12px'>Empty</td></tr>";
    else t.reverse().forEach(i => {
        td += i.discount;
        h += `<tr><td style="color:#134E5E;font-size:11px">${i.code}</td><td>₹${i.invoice}</td><td class="col-right" style="color:red">-₹${i.discount}</td><td class="col-right" style="font-weight:900;color:green">₹${i.final}</td></tr>`;
    });
    tb.innerHTML = h;
    document.getElementById('myRedeemCount').innerText = t.length;
    document.getElementById('myTotalDisc').innerText = "₹" + td;
} 
