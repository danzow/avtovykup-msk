import {validateLead} from './lead-validation.js';

const form=document.getElementById('car-form');
const fields=document.getElementById('form-fields');
const status=document.getElementById('form-status');
const button=form.querySelector('.form-submit');
const buttonLabel=button.querySelector('span');
const container=document.getElementById('turnstile-container');
const keys=['model','year','mileage','plate','condition','phone','consent'];
let busy=false,startedAt=Date.now(),scriptPromise,widget,widgetSize,pending,widgetGeneration=0;
fields.disabled=false;
function values(){
  const input={category:form.dataset.category,consent:document.getElementById('consent').checked};
  for(const key of keys.filter(k=>k!=='consent')) input[key]=document.getElementById(key).value;
  return input;
}
function error(key,message=''){
  const field=document.getElementById(key),output=document.getElementById(key+'-error');
  if(!field||!output) return;
  output.textContent=message;output.hidden=!message;
  if(message) field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');
}
function showStatus(message,contacts=false){
  const text=document.createElement('p');text.textContent=message;status.replaceChildren(text);status.hidden=false;
  if(contacts){
    const links=document.createElement('div');links.className='status-contacts';
    const call=document.createElement('a');call.href='tel:+79856656722';call.textContent='Позвонить';
    const wa=document.createElement('a');wa.href='whatsapp://send?phone=79856656722';wa.textContent='Написать в WhatsApp';wa.target='_blank';wa.rel='noopener noreferrer';
    links.append(call,wa);status.append(links);
  }
}
function setBusy(value){
  busy=value;fields.disabled=value;button.disabled=value;form.setAttribute('aria-busy',String(value));
  buttonLabel.textContent=value?'Отправляем заявку…':'Получить предварительную оценку';
}
function loadTurnstile(){
  if(window.turnstile) return Promise.resolve();
  if(scriptPromise) return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    const fail=()=>{clearTimeout(timer);script.remove();scriptPromise=undefined;reject(new Error('verification'));};
    const timer=setTimeout(fail,3000);
    script.onload=()=>{clearTimeout(timer);if(window.turnstile) resolve();else fail();};script.onerror=fail;
    document.head.append(script);
  });return scriptPromise;
}
function executeChallenge(){
  const size=fields.clientWidth<300?'compact':'flexible';
  if(widget!==undefined&&widgetSize!==size){window.turnstile.remove(widget);widget=undefined;widgetGeneration++;}
  if(widget===undefined){
    const generation=++widgetGeneration;
    const finish=value=>{if(generation===widgetGeneration)pending?.(value);};
    widget=window.turnstile.render(container,{sitekey:window.LEAD_CONFIG.sitekey,action:'lead',execution:'execute',appearance:'interaction-only',size,theme:'light',language:'ru',callback:finish,'error-callback':()=>{finish(false);return true;},'expired-callback':()=>finish(false),'timeout-callback':()=>finish(false),'response-field':false});
    widgetSize=size;
  }else window.turnstile.reset(widget);
  window.turnstile.execute(widget);
}
window.addEventListener('resize',()=>{
  if(pending&&widgetSize!==(fields.clientWidth<300?'compact':'flexible')){try{executeChallenge();}catch{pending?.(false);}}
});
async function token(){
  const sitekey=window.LEAD_CONFIG?.sitekey;
  if(!sitekey) throw new Error('verification');
  await loadTurnstile();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(false),3000);
    const finish=success=>{clearTimeout(timer);pending=undefined;success?resolve(success):reject(new Error('verification'));};
    pending=finish;
    try{
      executeChallenge();
    }catch{finish(false);}
  });
}
for(const key of keys){
  const field=document.getElementById(key);
  field.addEventListener(key==='consent'?'change':'input',()=>{
    if(!busy){status.hidden=true;status.replaceChildren();}
    if(field.hasAttribute('aria-invalid')) error(key,validateLead(values()).errors[key]||'');
  });
  field.addEventListener('blur',()=>{if(key!=='consent'&&field.value.trim()) error(key,validateLead(values()).errors[key]||'');});
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy) return;
  const validation=validateLead(values());
  for(const key of keys) error(key,validation.errors[key]||'');
  if(!validation.ok){showStatus('Проверьте отмеченные поля.');const first=keys.find(key=>validation.errors[key]);document.getElementById(first||'model').focus();return;}
  status.hidden=true;setBusy(true);
  try{
    const turnstileToken=await token();
    showStatus('Отправляем заявку…');
    const apiUrl=window.LEAD_CONFIG?.apiUrl || (window.location.hostname==='avtovykup-msk.com'?'https://api.avtovykup-msk.com/api/lead':'/api/lead');
    const response=await fetch(apiUrl,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({...validation.data,website:document.getElementById('website').value,formStartedAt:startedAt,turnstileToken}),signal:AbortSignal.timeout(25000)});
    let body;try{body=await response.json();}catch{throw new Error('unavailable');}
    if(response.status===429){showStatus('Слишком много попыток. Подождите немного и повторите.');return;}
    if(body.code==='verification') throw new Error('verification');
    if(body.code==='validation'&&body.errors){for(const key of keys) error(key,typeof body.errors[key]==='string'?body.errors[key]:'');showStatus('Проверьте отмеченные поля.');const first=keys.find(key=>body.errors[key]);if(first) document.getElementById(first).focus();return;}
    if(!response.ok||body.ok!==true) throw new Error('unavailable');
    form.reset();fields.hidden=true;
    showStatus('Заявка отправлена. Я посмотрю информацию об автомобиле и свяжусь с вами по указанному номеру.',true);
    status.focus({preventScroll:true});
  }catch(failure){
    showStatus(failure.message==='verification'?'Не удалось пройти проверку. Попробуйте ещё раз.':'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь со мной напрямую.',failure.message!=='verification');
  }finally{
    pending=undefined;if(widget!==undefined) {try{window.turnstile.reset(widget);}catch{}}
    setBusy(false);
  }
});
