import { z } from 'zod';
export const UsageEvent = z.object({ source:z.string().min(1).max(100), source_event_id:z.string().min(1).max(200), usage_class:z.enum(['build','run']), event_type:z.string().min(1).max(100), operation:z.string().min(1).max(200), model:z.string().nullable().optional(), lead_id:z.string().uuid().nullable().optional(), quantity:z.number().nonnegative().nullable().optional(), quantity_unit:z.string().nullable().optional(), credits:z.number().nonnegative().nullable().optional(), cost_amount:z.number().nonnegative().nullable().optional(), cost_currency:z.string().regex(/^[A-Z]{3}$/).nullable().optional(), amount_basis:z.enum(['actual','estimated','unknown']), evidence:z.string().min(1).max(1000), occurred_at:z.string().datetime() }).superRefine((v,c)=>{if((v.cost_amount==null)!=(v.cost_currency==null)) c.addIssue({code:'custom',message:'Amount needs currency'});if(v.amount_basis==='unknown'&&(v.credits!=null||v.cost_amount!=null)) c.addIssue({code:'custom',message:'Unknown usage cannot have a price'});});
export type UsageRow=z.infer<typeof UsageEvent>;
export function usageMonth(iso:string){return new Date(Date.parse(iso)+6*3600000).toISOString().slice(0,7);}
export function summarizeUsage(rows:UsageRow[]){
 const groups=new Map<string,{class:string;basis:string;currency:string;leadId:string|null;credits:number;amount:number;events:number}>();
 for(const r of rows){const currency=r.cost_currency??'—';const leadId=r.lead_id??null;const key=JSON.stringify([r.usage_class,r.amount_basis,currency,leadId]);const g=groups.get(key)??{class:r.usage_class,basis:r.amount_basis,currency,leadId,credits:0,amount:0,events:0};g.credits+=r.credits??0;g.amount+=r.cost_amount??0;g.events++;groups.set(key,g);}
 return [...groups.values()];
}
