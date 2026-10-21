// ===== 점수표 (총 100점) =====
const LOOKS_SCORE = { "예쁨": 20, "잘생김": 20, "적정": 10, "못생김": 0 };
const HEALTH_SCORE = { "매우 건강": 12, "건강": 8, "보통": 4, "나쁨": 0 };
const INCOME_SCORE = { "안정": 13, "보통": 7, "없음": 0 };

// 성격 키워드: 문장에 이 단어들이 들어 있으면 해당 성격으로 본다
const TRAITS = {
  "다정": ["다정", "따뜻", "배려", "친절", "상냥"],
  "활발": ["활발", "밝", "에너지", "수다", "외향"],
  "차분": ["차분", "조용", "침착", "신중", "내향", "인내"],
  "유머": ["유머", "웃기", "재밌", "장난"],
  "성실": ["성실", "꼼꼼", "책임감", "부지런"],
  "열정": ["열정", "도전", "적극"],
  "감성": ["감성", "섬세", "공감", "예술"],
  "솔직": ["솔직", "직설", "쿨"],
  "느긋": ["느긋", "여유", "긍정"],
  "즉흥": ["즉흥", "자유", "모험"],
  "계획": ["계획", "정리"],
};
// 서로 보완되는 성격 조합
const COMPLEMENTS = [["활발", "차분"]];

function findTraits(text) {
  return Object.keys(TRAITS).filter((t) => TRAITS[t].some((w) => (text || "").includes(w)));
}

// 같은 성격 1개 4점, 2개 7점, 3개 이상 10점 + 보완 조합 +3 (최대 10)
function personalityScore(myText, theirText) {
  const mine = findTraits(myText);
  const theirs = findTraits(theirText);
  if (!mine.length) return { score: 0, note: "내 성격에서 키워드를 찾지 못함" };
  const same = mine.filter((t) => theirs.includes(t));
  let score = [0, 4, 7][same.length] ?? 10;
  const comp = COMPLEMENTS.filter(([a, b]) =>
    (mine.includes(a) && theirs.includes(b)) || (mine.includes(b) && theirs.includes(a)));
  if (comp.length) score = Math.min(10, score + 3);
  const notes = [];
  if (same.length) notes.push(`같은 성격: ${same.join("·")}`);
  if (comp.length) notes.push(`보완: ${comp.map((c) => c.join("↔")).join(", ")}`);
  return { score, note: notes.join(" / ") || `겹치는 성격 없음 (상대: ${theirs.join("·") || "-"})` };
}

// ===== 성격 점수: 임베딩(의미 유사도)으로 점수, 키워드로 이유 =====
// 40명끼리 성격 문장을 비교한 유사도 분포에서 하위 10%(0.81)는 0점, 상위 10%(0.91)는 10점, 사이는 비례
const SIM_LOW = 0.81;
const SIM_HIGH = 0.91;

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / Math.sqrt(na * nb);
}

function similarityScore(sim) {
  const ratio = Math.min(1, Math.max(0, (sim - SIM_LOW) / (SIM_HIGH - SIM_LOW)));
  return Math.round(ratio * 20) / 2;
}

// 내 성격 임베딩이 있으면 의미 유사도로 점수를 매기고, 없으면(서버 연결 실패 등) 키워드 방식으로 계산한다
function personalityItem(me, p) {
  const keyword = personalityScore(me.personality, p.personality);
  const theirs = typeof PERSONALITY_EMBEDDINGS !== "undefined" && PERSONALITY_EMBEDDINGS[p.id];
  if (me.embedding && theirs) {
    const sim = cosine(me.embedding, theirs);
    return { score: similarityScore(sim), note: `의미 유사도 ${sim.toFixed(2)} · ${keyword.note}` };
  }
  return keyword;
}

// 상대가 여자면 160~170cm, 남자면 175~185cm에 만점
function heightScore(h, gender) {
  if (gender === "남") {
    if (h >= 175 && h <= 185) return 10;
    if (h >= 170) return 7;
    return 2;
  }
  if (h >= 160 && h <= 170) return 10;
  if (h >= 171 && h <= 175) return 7;
  if (h >= 176) return 4;
  return 2;
}

function ageScore(diff) {
  if (diff <= 2) return 10;
  if (diff <= 5) return 6;
  return 2;
}

// S/N이 다르면 0점, S/N이 같고 E/I가 다르면 5점, 둘 다 같으면 3점
function mbtiScore(a, b) {
  if (a[1] !== b[1]) return { score: 0, note: "S/N 성향 다름" };
  if (a[0] !== b[0]) return { score: 5, note: "S/N 같고 E/I 보완" };
  return { score: 3, note: "S/N, E/I 모두 같음" };
}

function scorePerson(me, p) {
  const common = p.interests.filter((i) => me.interests.includes(i));
  const perInterest = me.interests.length ? 15 / me.interests.length : 0;
  const ageDiff = Math.abs(me.age - p.age);
  const mbti = mbtiScore(me.mbti, p.mbti);
  const pers = personalityItem(me, p);

  const items = [
    { key: "외모", max: 20, score: LOOKS_SCORE[p.looks] ?? 0, note: `${p.looks} · ${p.animal}` },
    { key: "관심사", max: 15, score: Math.min(15, common.length * perInterest),
      note: common.length ? `${common.join("·")} 겹침` : "겹치는 관심사 없음" },
    { key: "직업", max: 13, score: INCOME_SCORE[p.income] ?? 0, note: `${p.job} (수입 ${p.income})` },
    { key: "건강", max: 12, score: HEALTH_SCORE[p.health] ?? 0, note: p.health },
    { key: "키", max: 10, score: heightScore(p.height, p.gender), note: `${p.height}cm` },
    { key: "나이", max: 10, score: ageScore(ageDiff), note: `${p.age}세 (${ageDiff}살 차이)` },
    { key: "성격", max: 10, score: pers.score, note: pers.note },
    { key: "MBTI", max: 5, score: mbti.score, note: `${p.mbti} · ${mbti.note}` },
    { key: "종교", max: 5, score: p.religion === me.religion ? 5 : 0,
      note: p.religion === me.religion ? `${p.religion} 같음` : `${p.religion}` },
  ];
  const total = items.reduce((s, i) => s + i.score, 0);
  return { person: p, items, total };
}

// ===== 거르기: 걸리면 이유를 반환, 통과하면 null =====
function filterReason(me, cond, p) {
  if (p.id === me.id) return "나 자신";
  if (p.gender === me.gender) return "같은 성별";
  if (p.age < cond.minAge || p.age > cond.maxAge) return `나이 ${cond.minAge}~${cond.maxAge}세 밖 (${p.age}세)`;
  if (p.height < cond.minHeight) return `키 ${cond.minHeight}cm 미만 (${p.height}cm)`;
  if (cond.needIncome && p.income === "없음") return `수입 없음 (${p.job})`;
  if (cond.noSmoker && p.smoker) return "흡연자";
  return null;
}

// 총점이 같으면 배점이 큰 항목(외모 → 관심사 → 직업 → 건강 → 키 → 나이 → 성격 → MBTI → 종교) 순으로 비교
function byPriority(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  for (let i = 0; i < a.items.length; i++) {
    if (b.items[i].score !== a.items[i].score) return b.items[i].score - a.items[i].score;
  }
  return 0;
}

// ===== 화면 =====
const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(1));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 가상 인물 사진: images/{id}.jpg
const photo = (p) => `<img src="images/${p.id}.jpg" alt="${esc(p.name)} 사진" loading="lazy">`;

// 내 사진: 브라우저 안에서만 쓰고 업로드하지 않는다
let myPhotoUrl = null;

// ===== AI 설명 =====
// 점수는 위의 로직이 계산하고, AI(Gemini)는 그 결과를 자연스러운 문장으로 풀어 설명만 한다.
// Gemini API 키는 Cloudflare Worker에 숨겨 두고, 사이트는 Worker 주소로만 요청한다.
const AI_URL = "https://love-ai.love-ai-worker.workers.dev";
let lastMatch = null;

async function explainWithAI() {
  if (!lastMatch) return;
  const { me, passed } = lastMatch;
  const [first, second] = passed;
  const btn = $("aiBtn");
  const out = $("aiText");
  btn.disabled = true;
  btn.textContent = "AI가 설명을 쓰는 중…";
  out.hidden = false;
  out.classList.remove("ai-error");
  out.textContent = "";

  const payload = {
    me: { gender: me.gender, age: me.age, interests: me.interests.join(", "), mbti: me.mbti, religion: me.religion, personality: me.personality },
    first: { name: first.person.name, age: first.person.age, job: first.person.job, personality: first.person.personality, total: first.total, items: first.items },
    second: second ? { name: second.person.name, total: second.total } : null,
    diffs: second ? diffList(first, second).join(", ") : "",
  };

  try {
    const res = await fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) throw new Error(data.error || "AI 설명을 지금 불러올 수 없어요.");
    await typeOut(out, data.text);
    btn.textContent = "✨ 다시 듣기";
  } catch (e) {
    out.classList.add("ai-error");
    out.textContent = `${e.message.startsWith("Failed") ? "AI 서버에 연결할 수 없어요." : e.message} 위의 이유 설명은 그대로 확인할 수 있어요.`;
    btn.textContent = "✨ 다시 시도";
  }
  btn.disabled = false;
}

// ===== 1위에게 메시지 보내기 (가상 인물은 AI가 성격대로 답장) =====
// 상대 id → 대화 목록. 페이지 안에서만 기억하고, 새로고침하면 사라진다
const chats = new Map();
let chatBusy = false;
const nowTime = () => new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

function renderChat(typing = false) {
  const p = lastMatch.passed[0].person;
  const msgs = chats.get(p.id) || [];
  const log = $("chatLog");
  $("chatInput").placeholder = msgs.length ? "메시지를 입력하세요" : "첫 메시지를 보내 보세요";
  if (!msgs.length && !typing) {
    log.innerHTML = `<p class="chat-empty">${esc(p.name)}님은 가상 인물이라, AI가 ${esc(p.name)}님의 성격대로 답장해요.</p>`;
    return;
  }
  log.innerHTML = msgs.map((m) => m.role === "system"
    ? `<p class="chat-system">${esc(m.text)}</p>`
    : `<div class="bubble-row ${m.role}">
        ${m.role === "them" ? photo(p) : ""}
        <div>
          <p class="bubble">${esc(m.text)}</p>
          <span class="bubble-time">${m.role === "me" ? "전송됨 · " : ""}${m.time}</span>
        </div>
      </div>`).join("")
    + (typing ? `<div class="bubble-row them">${photo(p)}<p class="bubble typing">${esc(p.name)}님이 입력 중<i>.</i><i>.</i><i>.</i></p></div>` : "");
  log.scrollTop = log.scrollHeight;
}

async function sendChat(text) {
  const { me, passed } = lastMatch;
  const p = passed[0].person;
  if (!chats.has(p.id)) chats.set(p.id, []);
  const msgs = chats.get(p.id);
  msgs.push({ role: "me", text, time: nowTime() });

  chatBusy = true;
  $("chatInput").disabled = true;
  renderChat(true);
  try {
    const res = await fetch(`${AI_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona: { name: p.name, gender: p.gender, age: p.age, job: p.job, interests: p.interests.join(", "), mbti: p.mbti, animal: p.animal, personality: p.personality },
        // 이름 칸을 비우면 readMe()가 "나"로 채우는데, 그건 호칭으로 쓰지 않는다
        me: { age: me.age, interests: me.interests.join(", "), name: me.name === "나" ? "" : me.name },
        messages: msgs.filter((m) => m.role !== "system").map(({ role, text }) => ({ role, text })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) throw new Error();
    msgs.push({ role: "them", text: data.text, time: nowTime() });
  } catch {
    msgs.push({ role: "system", text: `${p.name}님의 답장을 불러오지 못했어요. 메시지는 보내졌어요.` });
  }
  chatBusy = false;
  // 답장을 기다리는 동안 매칭을 다시 돌렸으면 화면이 바뀌었을 수 있다
  if (!$("chatLog") || lastMatch.passed[0].person.id !== p.id) return;
  $("chatInput").disabled = false;
  $("chatInput").focus();
  renderChat();
}

// 한 글자씩 써지는 효과
function typeOut(el, text) {
  return new Promise((resolve) => {
    let i = 0;
    const timer = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(timer); resolve(); }
    }, 18);
  });
}

function readMe() {
  return {
    id: "me",
    name: $("name").value.trim() || "나",
    gender: $("gender").value,
    age: Number($("age").value),
    height: Number($("height").value),
    looks: $("looks").value,
    animal: $("animal").value.trim() || "-",
    religion: $("religion").value,
    interests: $("interests").value.split(",").map((s) => s.trim()).filter(Boolean),
    job: $("job").value.trim() || "-",
    income: "없음",
    mbti: $("mbti").value,
    health: $("health").value,
    smoker: $("smoker").value === "yes",
    personality: $("personality").value.trim(),
  };
}

function readCond() {
  return {
    minAge: Number($("minAge").value),
    maxAge: Number($("maxAge").value),
    minHeight: Number($("minHeight").value),
    needIncome: $("needIncome").checked,
    noSmoker: $("noSmoker").checked,
  };
}

// 필수 칸이 비어 있으면 빨간 테두리로 표시하고 첫 번째 빈칸으로 이동
function checkProfile() {
  const missing = [...document.querySelectorAll("#step1 [required]")].filter((el) => !el.value.trim());
  document.querySelectorAll("#step1 .invalid").forEach((el) => el.classList.remove("invalid"));
  missing.forEach((el) => el.classList.add("invalid"));
  if (!missing.length) {
    $("formError").hidden = true;
    return true;
  }
  const names = missing.map((el) => el.closest("label").firstChild.textContent.trim());
  $("formError").textContent = `프로필에서 빈칸을 채워주세요: ${names.join(", ")}`;
  $("formError").hidden = false;
  missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
  missing[0].focus({ preventScroll: true });
  return false;
}

// 내 성격 문장을 AI 서버에서 임베딩으로 바꾼다. 실패하면 null (그때는 키워드 방식으로 계산)
const embedCache = new Map();
async function embedPersonality(text) {
  if (!text) return null;
  if (embedCache.has(text)) return embedCache.get(text);
  try {
    const res = await fetch(`${AI_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const vec = res.ok && data.embeddings?.[0];
    if (!vec) return null;
    embedCache.set(text, vec);
    return vec;
  } catch {
    return null;
  }
}

async function run() {
  if (!checkProfile()) return;
  const me = readMe();
  const cond = readCond();

  const go = $("go");
  go.disabled = true;
  go.textContent = "성격 분석 중…";
  me.embedding = await embedPersonality(me.personality);
  go.disabled = false;
  go.textContent = "매칭 시작하기 ♥";
  const mode = !me.personality ? "none" : me.embedding ? "embedding" : "keyword";
  // ① 올린다: 내 프로필도 저장소에 들어간다
  const store = [...PROFILES, me];

  const passed = [];
  const removed = [];
  for (const p of store) {
    const reason = filterReason(me, cond, p);
    if (reason) removed.push({ person: p, reason });
    else passed.push(scorePerson(me, p));
  }
  passed.sort(byPriority);

  renderResult(me, store, passed, removed, mode);
  if (passed.length) renderChat();
  $("step3").scrollIntoView({ behavior: "smooth" });
}

// 각 순위의 이유: 강점, 약점, 바로 위 순위와의 차이
function rankReason(r, above) {
  const parts = [];
  const strong = r.items.filter((i) => i.score === i.max).map((i) => i.key);
  if (strong.length) parts.push(`<span class="plus">강점</span>${strong.join("·")} 만점`);

  const weak = r.items.filter((i) => i.score <= i.max / 2)
    .map((i) => `${i.key} ${fmt(i.score)}점(${esc(i.note)})`);
  if (weak.length) parts.push(`<span class="minus">약점</span>${weak.join(", ")}`);

  if (above) {
    const gap = above.total - r.total;
    const lost = r.items
      .map((i, idx) => ({ key: i.key, d: i.score - above.items[idx].score }))
      .filter((x) => x.d < 0)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((x) => `${x.key} ${fmt(x.d)}`);
    parts.push(gap === 0
      ? `<span class="gap">순위 차이</span>${esc(above.person.name)}님과 동점이지만 배점이 큰 항목에서 밀림 (${lost.join(", ")})`
      : `<span class="gap">순위 차이</span>위 순위 ${esc(above.person.name)}님보다 ${fmt(gap)}점 낮음 (주로 ${lost.join(", ")})`);
  }
  return `<ul class="rank-why">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
}

// 접힌 카드에 보이는 한 줄 요약
function oneLine(r) {
  const strong = r.items.filter((i) => i.score === i.max).map((i) => i.key);
  return strong.length ? `${strong.slice(0, 4).join("·")} 만점` : "만점 항목 없음";
}

function scoreBars(items) {
  return `<div class="bars">${items.map((i) => `
    <div class="bar-row">
      <span class="bar-key">${i.key}</span>
      <div class="bar"><div class="bar-fill" style="width:${(i.score / i.max) * 100}%"></div></div>
      <span class="bar-num">${fmt(i.score)}/${i.max}</span>
      <span class="bar-note">${esc(i.note)}</span>
    </div>`).join("")}</div>`;
}

// 1위와 2위의 항목별 점수 차이 (1위가 앞선 항목부터)
function diffList(first, second) {
  return first.items
    .map((i, idx) => ({ key: i.key, d: i.score - second.items[idx].score }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => b.d - a.d)
    .map((x) => `${x.key} ${x.d > 0 ? "+" : ""}${fmt(x.d)}`);
}

function whyFirst(me, passed, removed) {
  const first = passed[0];
  const lines = [];

  const full = first.items.filter((i) => i.score === i.max).map((i) => i.key);
  if (full.length) lines.push(`<b>만점 항목</b> ${full.join(", ")}`);

  const lost = first.items.filter((i) => i.score < i.max)
    .map((i) => `${i.key} -${fmt(i.max - i.score)} (${esc(i.note)})`);
  if (lost.length) lines.push(`<b>깎인 점수</b> ${lost.join(", ")}`);

  const second = passed[1];
  if (second) {
    lines.push(`<b>2위 ${esc(second.person.name)}님(${fmt(second.total)}점)보다 ${fmt(first.total - second.total)}점 높음</b> ${diffList(first, second).join(", ")}`);
  } else {
    lines.push("조건을 통과한 사람이 1명뿐이라 자동으로 1위입니다.");
  }

  // 거르기가 결과를 바꿨는지: 제외된 사람 중 1위보다 점수가 높았을 사람
  const beaten = removed
    .filter((r) => r.person.id !== me.id && r.person.gender !== me.gender)
    .map((r) => ({ r, s: scorePerson(me, r.person).total }))
    .filter((x) => x.s > first.total);
  for (const { r, s } of beaten) {
    lines.push(`<b>참고</b> ${esc(r.person.name)}님은 점수만 보면 ${fmt(s)}점이지만 ${esc(r.reason)} 조건으로 제외됐어요.`);
  }

  return `<ul class="why">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
}

const MODE_NOTE = {
  embedding: "성격 점수는 AI 임베딩으로 두 사람의 성격 문장이 뜻으로 얼마나 비슷한지 계산했어요.",
  keyword: "AI 서버에 연결되지 않아 성격 점수는 키워드 방식으로 계산했어요.",
  none: "성격을 입력하지 않아 성격 점수는 모두 0점이에요.",
};

function renderResult(me, store, passed, removed, mode) {
  const el = $("result");
  lastMatch = { me, passed };
  // 같은 성별은 인원이 많아서 한 줄로 묶어서 보여준다
  const sameGender = removed.filter((r) => r.reason === "같은 성별").length;
  const shown = removed.filter((r) => r.reason !== "같은 성별");
  const removedHtml = `
    <details class="filter-summary">
      <summary>필수 조건 결과: 전체 <b>${store.length}</b>명 중 <b>${removed.length}</b>명 제외, <b>${passed.length}</b>명 비교</summary>
      <ul class="removed">
        ${sameGender ? `<li><span>같은 성별</span>${sameGender}명</li>` : ""}
        ${shown.map((r) => `<li><span>${esc(r.reason)}</span>${esc(r.person.name)}</li>`).join("")}
      </ul>
    </details>`;

  if (passed.length === 0) {
    const counts = {};
    for (const r of removed) {
      const k = r.reason.split(" (")[0];
      counts[k] = (counts[k] || 0) + 1;
    }
    el.innerHTML = `
      <div class="empty">
        <h3>조건에 맞는 사람이 0명이에요</h3>
        <p>필수 조건이 너무 엄격해요. 많이 걸린 조건을 완화해 보세요.</p>
        <ul>${Object.entries(counts).map(([k, v]) => `<li>${esc(k)} ${v}명</li>`).join("")}</ul>
      </div>
      ${removedHtml}`;
    return;
  }

  const first = passed[0];
  const fp = first.person;
  const rest = passed.slice(1);

  el.innerHTML = `
    <p class="mode-note mode-${mode}">${MODE_NOTE[mode]}</p>
    <div class="match">
      <div class="match-top">
        <div class="couple">
          ${myPhotoUrl ? `<img src="${myPhotoUrl}" alt="내 사진"><span class="heart">♥</span>` : ""}
          ${photo(fp)}
        </div>
        <div class="match-info">
          <span class="crown">BEST MATCH · 1위</span>
          <h3>${esc(fp.name)}</h3>
          <div class="meta">
            <span>${fp.age}세</span><span>${fp.height}cm</span><span>${esc(fp.job)}</span>
            <span>${esc(fp.animal)}</span><span>${esc(fp.mbti)}</span>
          </div>
          <p class="quote">"${esc(fp.personality)}"</p>
        </div>
        <div class="ring" style="--p:${first.total}"><span>${fmt(first.total)}<small>/ 100점</small></span></div>
      </div>
      <h4 class="why-title">왜 이 사람이 1위인가?</h4>
      ${whyFirst(me, passed, removed)}
      ${scoreBars(first.items)}
      <div class="ai-box">
        <button id="aiBtn" class="ai-btn">✨ AI에게 매칭 이유 듣기</button>
        <p id="aiText" class="ai-text" hidden></p>
      </div>
      <div class="chat">
        <h4 class="why-title">💌 ${esc(fp.name)}님에게 메시지 보내기</h4>
        <div class="chat-log" id="chatLog"></div>
        <form id="chatForm" class="chat-form">
          <input id="chatInput" maxlength="300" placeholder="첫 메시지를 보내 보세요" autocomplete="off">
          <button>보내기</button>
        </form>
      </div>
    </div>

    ${removedHtml}

    ${rest.length ? `
      <h3 class="list-title">2위부터 순위와 이유 <span class="muted">눌러서 자세히 보기</span></h3>
      <div class="ranking">
        ${rest.map((r, i) => `
          <details class="rank-card">
            <summary>
              <span class="rank-no">${i + 2}</span>
              ${photo(r.person)}
              <div>
                <div class="rank-name">${esc(r.person.name)}<small>${r.person.age}세 · ${r.person.height}cm · ${esc(r.person.job)}</small></div>
                <div class="rank-line">${oneLine(r)}</div>
              </div>
              <span class="score-pill">${fmt(r.total)}</span>
            </summary>
            <div class="rank-body">
              ${rankReason(r, passed[i])}
              ${scoreBars(r.items)}
            </div>
          </details>`).join("")}
      </div>` : ""}

    <details class="table-details">
      <summary>항목별 점수표 전체 보기</summary>
      <div class="table-wrap">
        <table>
          <thead><tr><th>순위</th><th>이름</th>${first.items.map((i) => `<th>${i.key}<small>${i.max}</small></th>`).join("")}<th>총점</th></tr></thead>
          <tbody>
            ${passed.map((r, idx) => `
              <tr class="${idx === 0 ? "top" : ""}">
                <td>${idx + 1}</td>
                <td>${esc(r.person.name)}</td>
                ${r.items.map((i) => `<td title="${esc(i.note)}">${fmt(i.score)}</td>`).join("")}
                <td><b>${fmt(r.total)}</b></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`;
}

// 점수 배분 막대: scorePerson의 배점을 그대로 가져와서 그린다
function renderWeights() {
  const items = scorePerson(readMe(), PROFILES[0]).items;
  const color = (i) => `hsl(${335 - i * (80 / (items.length - 1))}, 85%, 62%)`;
  $("weightBar").innerHTML = items.map((it, i) =>
    `<div style="flex:${it.max};background:${color(i)}" title="${it.key} ${it.max}점">${it.max >= 10 ? it.key : ""}</div>`).join("");
  $("weightLegend").innerHTML = items.map((it, i) =>
    `<span style="--c:${color(i)}">${it.key}<b>${it.max}</b></span>`).join("");
}

function renderStore() {
  const women = PROFILES.filter((p) => p.gender === "여").length;
  $("storeCount").textContent = `가상 인물 ${PROFILES.length}명 · 여 ${women} · 남 ${PROFILES.length - women}`;
  $("store").innerHTML = PROFILES.map((p) => `
    <div class="card">
      ${photo(p)}
      <div>
        <b>${esc(p.name)}</b>
        <p>${p.gender} · ${p.age}세 · ${p.height}cm · ${esc(p.mbti)}</p>
        <p>${esc(p.job)} · ${esc(p.animal)}${p.smoker ? " · 흡연" : ""}</p>
        <p>"${esc(p.personality)}"</p>
      </div>
    </div>`).join("");
}

function renderHero() {
  const faces = ["p01", "m01", "p03", "m11", "p17", "m17"];
  $("heroFaces").innerHTML = faces
    .map((id) => PROFILES.find((p) => p.id === id))
    .filter(Boolean)
    .map(photo).join("");
}

renderHero();
renderWeights();
renderStore();
$("go").addEventListener("click", run);
$("result").addEventListener("click", (e) => {
  if (e.target.closest("#aiBtn")) explainWithAI();
});
$("result").addEventListener("submit", (e) => {
  if (e.target.id !== "chatForm") return;
  e.preventDefault();
  const text = $("chatInput").value.trim();
  if (!text || chatBusy) return;
  $("chatInput").value = "";
  sendChat(text);
});

// 성격을 입력하면 인식된 키워드를 바로 보여준다
$("personality").addEventListener("input", () => {
  const t = findTraits($("personality").value);
  $("traitHint").innerHTML = t.length
    ? `인식된 성격 ${t.map((x) => `<span class="chip">${x}</span>`).join("")}`
    : "인식 가능한 성격: 다정, 활발, 차분, 유머, 성실, 열정, 감성, 솔직, 느긋, 즉흥, 계획";
});

// 빈칸을 채우면 빨간 테두리를 바로 없앤다
document.querySelectorAll("#step1 [required]").forEach((el) => {
  const clear = () => { if (el.value.trim()) el.classList.remove("invalid"); };
  el.addEventListener("input", clear);
  el.addEventListener("change", clear);
});
$("personality").dispatchEvent(new Event("input"));

$("myPhoto").addEventListener("change", () => {
  const file = $("myPhoto").files[0];
  if (myPhotoUrl) URL.revokeObjectURL(myPhotoUrl);
  myPhotoUrl = file ? URL.createObjectURL(file) : null;
  $("myPhotoPreview").src = myPhotoUrl || "";
  $("myPhotoPreview").hidden = !myPhotoUrl;
  $("myPhotoEmpty").hidden = !!myPhotoUrl;
});

// 성별을 바꾸면 상대 최소 키 기본값도 바꾼다 (남 → 여자 상대 160cm, 여 → 남자 상대 170cm)
$("gender").addEventListener("change", () => {
  $("minHeight").value = $("gender").value === "남" ? 160 : 170;
});
