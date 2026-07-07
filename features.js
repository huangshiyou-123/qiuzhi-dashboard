// ============ Interview Feature ============
var interviewType = 'all';

function setInterviewType(type, btn) {
  interviewType = type;
  var btns = document.querySelectorAll('#intvTypeBtns .btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
}

async function generateInterview() {
  var jdId = document.getElementById('interviewJdSelect').value;
  if (!jdId) { showToast('请先选择一条JD', 'error'); return; }
  var parsed;
  if (jdId === '_recent') {
    if (!window._lastParsedJD) { showToast('刚解析的JD已失效，请重新解析', 'error'); return; }
    parsed = window._lastParsedJD.parsed;
  } else {
    var app = await db.applications.get(parseInt(jdId));
    parsed = app.jdParsed || app.jdRaw;
  }
  var box = document.getElementById('interviewResult');
  box.style.display = 'block'; box.className = 'result-box loading'; box.textContent = 'AI生成面试题中...';
  var resumeSetting = await db.settings.get('resume');
  var resume = resumeSetting ? resumeSetting.value : '';
  var prompts = {};
  prompts['all'] = '请为该岗位生成全套面试准备：1.自我介绍模板(30秒/1分钟/2分钟三个版本) 2.技术/专业问题(5-8题附参考答案) 3.行为面试题(3-5题，用STAR方法提示思路) 4.反问面试官(2-3个) 5.场景题(1-2题)';
  prompts['self'] = '请生成针对该岗位的自我介绍模板，包括30秒、1分钟、2分钟三个版本。结合JD要求和候选人简历定制，突出匹配度。';
  prompts['tech'] = '请基于该JD的硬技能要求，生成5-8个专业面试问题，每题附参考答案。';
  prompts['behavior'] = '请基于该岗位特点，生成3-5个行为面试题(参考STAR方法)。每题说明考察意图和答题思路。';
  prompts['ask'] = '请生成3-4个反问面试官的问题，要体现对公司和岗位做了功课，有思考深度。';
  var promptText = prompts[interviewType] || prompts['all'];
  try {
    var output = await callDeepSeek(
      '你是一个资深面试教练。\n\n## 目标JD\n' + parsed + '\n\n## 候选人简历\n' + (resume || '（未提供）'),
      promptText
    );
    box.className = 'result-box';
    box.innerHTML = '<h4 style="margin-top:0">面试备战方案</h4>' + markdownToHtml(output);
    window._lastInterviewResult = box.innerHTML;
  } catch(e) { box.className = 'result-box'; box.textContent = '生成失败：' + e.message; }
}

// ============ Offer Comparison ============
function renderOfferCompare(container) {
  var h = '';
  h += '<div class="card"><h3>Offer对比器</h3>';
  h += '<p style="color:var(--muted);margin-bottom:8px">上传两张Offer截图，AI自动识别并对比分析。也可手动填写。</p>';
  h += '<div class="two-col">';

  // Offer A
  h += '<div><h4 style="margin-bottom:8px">Offer A</h4>';
  h += '<div id="offerAUploadZone" style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;margin-bottom:8px" onclick="document.getElementById(\'offerAInput\').click()">';
  h += '<div style="font-size:28px">上传截图</div><div style="font-size:12px">点击上传Offer A截图</div>';
  h += '<input type="file" id="offerAInput" accept="image/*" style="display:none" onchange="offerImageSelected(event,\'A\')">';
  h += '</div>';
  h += '<div id="offerAPreview" style="display:none;margin-bottom:8px;text-align:center"></div>';
  h += '<button class="btn btn-outline btn-sm" onclick="ocrOffer(\'A\')" id="offerAOcrBtn" style="display:none;width:100%">识别截图</button>';
  h += '<div style="text-align:center;color:var(--muted);font-size:12px;margin:8px 0">或者手动填写</div>';
  h += '<textarea id="offerAText" style="min-height:80px" placeholder="粘贴Offer A的所有信息（公司/薪资/福利/通勤...）"></textarea>';
  h += '</div>';

  // Offer B
  h += '<div><h4 style="margin-bottom:8px">Offer B</h4>';
  h += '<div id="offerBUploadZone" style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;margin-bottom:8px" onclick="document.getElementById(\'offerBInput\').click()">';
  h += '<div style="font-size:28px">上传截图</div><div style="font-size:12px">点击上传Offer B截图</div>';
  h += '<input type="file" id="offerBInput" accept="image/*" style="display:none" onchange="offerImageSelected(event,\'B\')">';
  h += '</div>';
  h += '<div id="offerBPreview" style="display:none;margin-bottom:8px;text-align:center"></div>';
  h += '<button class="btn btn-outline btn-sm" onclick="ocrOffer(\'B\')" id="offerBOcrBtn" style="display:none;width:100%">识别截图</button>';
  h += '<div style="text-align:center;color:var(--muted);font-size:12px;margin:8px 0">或者手动填写</div>';
  h += '<textarea id="offerBText" style="min-height:80px" placeholder="粘贴Offer B的所有信息（公司/薪资/福利/通勤...）"></textarea>';
  h += '</div>';

  h += '</div>';
  h += '<div class="btn-group"><button class="btn btn-primary" onclick="compareOfferScreenshots()">AI分析对比</button><button class="btn btn-outline" onclick="clearOfferCompare()">清空</button></div>';
  h += '<div class="result-box" id="offerResult" style="display:none;margin-top:16px"></div>';
  h += '</div>';
  container.innerHTML = h;
  // 恢复之前的状态
  setTimeout(function() {
    ['A','B'].forEach(function(s) {
      var img = s === 'A' ? window._offerAImage : window._offerBImage;
      if (img) {
        var preview = document.getElementById('offer' + s + 'Preview');
        if (preview) { preview.style.display = 'block'; preview.innerHTML = '<img src="' + img + '" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid var(--border)">'; }
        var btn = document.getElementById('offer' + s + 'OcrBtn');
        if (btn) btn.style.display = 'block';
        var zone = document.getElementById('offer' + s + 'UploadZone');
        if (zone) zone.style.display = 'none';
      }
      var savedText = s === 'A' ? window._offerAText : window._offerBText;
      if (savedText) { var el = document.getElementById('offer' + s + 'Text'); if (el) el.value = savedText; }
    });
    if (window._lastOfferResult) { var b = document.getElementById('offerResult'); if (b) { b.style.display = 'block'; b.className = 'result-box'; b.innerHTML = window._lastOfferResult; } }
  }, 100);
}

function offerImageSelected(event, side) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    if (side === 'A') window._offerAImage = dataUrl;
    else window._offerBImage = dataUrl;
    var preview = document.getElementById('offer' + side + 'Preview');
    preview.style.display = 'block';
    preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid var(--border)">';
    document.getElementById('offer' + side + 'OcrBtn').style.display = 'block';
    document.getElementById('offer' + side + 'UploadZone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function ocrOffer(side) {
  var imgData = side === 'A' ? window._offerAImage : window._offerBImage;
  if (!imgData) { showToast('请先上传截图', 'error'); return; }
  var btn = document.getElementById('offer' + side + 'OcrBtn');
  btn.textContent = '识别中...'; btn.disabled = true;
  try {
    var qwenKey = await db.settings.get('qwenApiKey');
    var key = (qwenKey && qwenKey.value) ? qwenKey.value : DEFAULT_QWEN_KEY;
    var text = await callQwenVL(key, imgData);
    var txtEl = document.getElementById('offer' + side + 'Text');
    if (txtEl) txtEl.value = text;
    if (side === 'A') window._offerAText = text; else window._offerBText = text;
    showToast('识别完成', 'success');
  } catch(e) {
    showToast('OCR失败：' + e.message, 'error');
  }
  btn.textContent = '识别截图'; btn.disabled = false;
}

async function compareOfferScreenshots() {
  var a = document.getElementById('offerAText').value.trim();
  var b = document.getElementById('offerBText').value.trim();
  if (!a || !b) { showToast('请上传截图并识别，或手动填写Offer信息', 'error'); return; }
  var box = document.getElementById('offerResult');
  box.style.display = 'block'; box.className = 'result-box loading'; box.textContent = 'AI分析中...';
  try {
    var output = await callDeepSeek(
      '你是一个职业规划顾问。请对比分析以下两份Offer。\n\n规则：从薪资、福利、通勤、发展空间、工作强度等维度逐项对比。指出各自优劣。给出综合建议，不要只说选A或选B。信息不足的维度标注出来。不要使用星号格式，用Markdown标题和列表。',
      '## Offer A\n' + a + '\n\n## Offer B\n' + b
    );
    box.className = 'result-box';
    box.innerHTML = '<h4 style="margin-top:0">对比分析</h4>' + markdownToHtml(output);
    window._lastOfferResult = box.innerHTML;
  } catch(e) { box.className = 'result-box'; box.textContent = '分析失败：' + e.message; }
}

function clearOfferCompare() {
  ['offerAText','offerBText'].forEach(function(id){ var el = document.getElementById(id); if(el) el.value = ''; });
  ['A','B'].forEach(function(s){
    var p = document.getElementById('offer' + s + 'Preview'); if(p) p.style.display = 'none';
    var u = document.getElementById('offer' + s + 'UploadZone'); if(u) u.style.display = 'block';
    var b = document.getElementById('offer' + s + 'OcrBtn'); if(b) b.style.display = 'none';
  });
  window._offerAImage = null; window._offerBImage = null;
  var box = document.getElementById('offerResult'); if(box) box.style.display = 'none';
}
