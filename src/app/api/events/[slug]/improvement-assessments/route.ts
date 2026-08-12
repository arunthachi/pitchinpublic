import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ sourcePitchId: z.string().uuid(), laterPitchId: z.string().uuid(), blindedOrder: z.array(z.string().uuid()).length(2), criterionScores: z.array(z.object({ criterionKey: z.string().min(1).max(40), source: z.number().min(1).max(5), later: z.number().min(1).max(5) }).strict()).min(1).max(6) }).strict();
function client(request: NextRequest) { return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', { cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} } }); }
async function eventId(supabase: ReturnType<typeof client>, slug: string) { const { data } = await supabase.from('pitch_events').select('id').eq('slug',slug).maybeSingle(); return data?.id as string|undefined; }

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
 const { slug }=await props.params; const supabase=client(request); const { data:{user} }=await supabase.auth.getUser();
 if(!user) return NextResponse.json({success:false,error:'Authentication required'},{status:401}); const id=await eventId(supabase,slug); if(!id) return NextResponse.json({success:false,error:'Event not found'},{status:404});
 const {data,error}=await supabase.from('pitch_improvement_assessments').select('id,event_id,source_pitch_id,later_pitch_id,guideline_version_id,assessor_id,criterion_scores,later_take_better,created_at').eq('event_id',id).order('created_at',{ascending:false}).limit(100);
 if(error) return NextResponse.json({success:false,error:'Manager access required'},{status:403}); return NextResponse.json({success:true,assessments:data||[]});
}
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
 const {slug}=await props.params; const supabase=client(request); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({success:false,error:'Authentication required'},{status:401});
 const parsed=schema.safeParse(await request.json().catch(()=>({}))); if(!parsed.success)return NextResponse.json({success:false,error:'Add valid criterion scores for both takes.'},{status:400}); const id=await eventId(supabase,slug); if(!id)return NextResponse.json({success:false,error:'Event not found'},{status:404});
 const value=parsed.data; const {data,error}=await supabase.rpc('assess_pitch_improvement',{target_event_id:id,source_pitch:value.sourcePitchId,later_pitch:value.laterPitchId,scores:value.criterionScores,blind_order:value.blindedOrder});
 if(error)return NextResponse.json({success:false,error:error.message},{status:403}); return NextResponse.json({success:true,assessment:data},{status:201});
}
