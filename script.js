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
  const pers = personalityScore(me.personality, p.personality);

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

function run() {
  const me = readMe();
  const cond = readCond();
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

  renderResult(me, store, passed, removed);
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
    const diffs = first.items
      .map((i, idx) => ({ key: i.key, d: i.score - second.items[idx].score }))
      .filter((x) => x.d !== 0)
      .sort((a, b) => b.d - a.d)
      .map((x) => `${x.key} ${x.d > 0 ? "+" : ""}${fmt(x.d)}`);
    lines.push(`<b>2위 ${esc(second.person.name)}님(${fmt(second.total)}점)보다 ${fmt(first.total - second.total)}점 높음</b> ${diffs.join(", ")}`);
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

function renderResult(me, store, passed, removed) {
  const el = $("result");
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

// 성격을 입력하면 인식된 키워드를 바로 보여준다
$("personality").addEventListener("input", () => {
  const t = findTraits($("personality").value);
  $("traitHint").innerHTML = t.length
    ? `인식된 성격 ${t.map((x) => `<span class="chip">${x}</span>`).join("")}`
    : "인식된 성격 키워드가 없어요 (다정, 활발, 차분, 유머, 성실, 열정, 감성, 솔직, 느긋, 즉흥, 계획)";
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
