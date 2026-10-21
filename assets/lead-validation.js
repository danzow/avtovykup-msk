export const LIMITS = Object.freeze({model:120,year:4,mileage:20,plate:32,condition:3000,phone:32,maxMileage:5000000});
export const RISK = Object.freeze({suspicious:40,high:70});
const letters = /\p{L}/u;
const clean = value => value.normalize('NFC').replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g,'').trim();
export function normalizePhone(value) {
  if(typeof value !== 'string' || value.length>LIMITS.phone) return null;
  const text=clean(value);
  if(!/^[\d\s()+\-]+$/.test(text)) return null;
  let digits=text.replace(/\D/g,'');
  if(digits.length===10) digits='7'+digits;
  if(digits.length===11 && digits.startsWith('8')) digits='7'+digits.slice(1);
  if(!/^7[349]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits.slice(1))) return null;
  return '+'+digits;
}
export function validateLead(input, currentYear = new Date().getFullYear()) {
  const errors={},data={};
  if(!input || typeof input!=='object' || Array.isArray(input)) return {ok:false,errors:{form:'Проверьте заполнение формы.'}};
  data.category=input.category;
  if(!['suv','minivan'].includes(data.category)) errors.category='Выберите направление выкупа.';
  for(const field of ['model','year','mileage','plate','condition','phone']){
    const raw=input[field];
    const numeric=['year','mileage'].includes(field) && typeof raw==='number' && Number.isSafeInteger(raw);
    if((typeof raw!=='string' && !numeric) || String(raw).length>LIMITS[field]) {errors[field]='Проверьте значение этого поля.';data[field]='';continue;}
    data[field]=clean(String(raw));
  }
  if(!data.model || !letters.test(data.model)) errors.model='Укажите марку и модель автомобиля.';
  else data.model=data.model.replace(/\s+/g,' ');
  const year=data.year;
  if(!/^\d{4}$/.test(year) || Number(year)<1950 || Number(year)>currentYear+1) errors.year='Укажите год от 1950 до '+(currentYear+1)+'.';
  else data.year=Number(year);
  const mileage=data.mileage.replace(/\s/g,'');
  if(!/^\d+$/.test(mileage) || !Number.isSafeInteger(Number(mileage)) || Number(mileage)>LIMITS.maxMileage) errors.mileage='Укажите пробег целым числом от 0 до 5 000 000 км.';
  else data.mileage=Number(mileage);
  data.plate=data.plate.toUpperCase().replace(/\s+/g,' ');
  const compactPlate=data.plate.replace(/[\s-]/g,'');
  if(compactPlate.length<4 || compactPlate.length>20 || /[^\p{L}\d\s-]/u.test(data.plate) || !letters.test(data.plate) || !/\d/.test(data.plate)) errors.plate='Укажите госномер: буквы и цифры, например А123АА 777.';
  if(!data.condition || !letters.test(data.condition)) errors.condition='Кратко опишите состояние автомобиля.';
  data.phone=normalizePhone(data.phone);
  if(!data.phone) errors.phone='Укажите российский номер: +7 и 10 цифр. Можно начать с 8.';
  data.consent=input.consent===true;
  if(!data.consent) errors.consent='Подтвердите согласие на обработку указанных данных.';
  return {ok:Object.keys(errors).length===0,errors,data};
}
export function scoreLead(data, {elapsedMs} = {}) {
  let score=0;
  const text=(data.model+' '+data.condition).toLowerCase();
  if(Number.isFinite(elapsedMs) && elapsedMs>=0 && elapsedMs<2500) score+=20;
  if(/qwerty|asdf|zxcv|йцукен|фыва|123123123/i.test(text)) score+=40;
  if(/([^\s])\1{6,}/u.test(text)) score+=30;
  if((text.match(/(?:https?:\/\/|www\.)\S+/gi)||[]).length>=2) score+=20;
  if(/\S{60,}/u.test(text)) score+=15;
  const chars=[...text.replace(/\s/g,'')],length=chars.length;
  if(length>15){
    if(chars.filter(c=>/\d/.test(c)).length/length>.6) score+=15;
    if(chars.filter(c=>letters.test(c)).length/length<.1) score+=15;
    if(chars.filter(c=>/[^\p{L}\d]/u.test(c)).length/length>.5) score+=15;
  }
  score=Math.min(100,score);
  return {score,level:score>=RISK.high?'high_risk':score>=RISK.suspicious?'suspicious':'normal'};
}
export function signature(data) {
  const normalized = value => String(value).normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
  return JSON.stringify([data.category,normalized(data.model),String(data.year),String(data.mileage),normalized(data.plate).replace(/[\s-]/g,''),normalized(data.condition),data.phone]);
}
