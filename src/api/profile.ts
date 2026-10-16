import {control} from './control';import {readConnectionSettings} from './index';
export interface DisplayProfile {name:string;nickname:string;avatar:string;updatedAt:number}
const empty=():DisplayProfile=>({name:'',nickname:'',avatar:'',updatedAt:0});
export async function loadProfile():Promise<DisplayProfile>{if(readConnectionSettings().mode==='mock')return JSON.parse(localStorage.getItem('delta.demo.profile')||'null')||empty();return control('web.profile_get')}
export async function saveProfile(profile:DisplayProfile):Promise<DisplayProfile>{if(readConnectionSettings().mode==='mock'){const p={...profile,updatedAt:Date.now()};localStorage.setItem('delta.demo.profile',JSON.stringify(p));return p}return control('web.profile_save',{profile})}
