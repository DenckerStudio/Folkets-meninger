import json,re,unicodedata,collections,random,difflib
CATS=['eksakt_sak','tema','prefiks_delord','sammensatte_ord','voteringer_parti','horinger','finnes_ikke']
S25=json.load(open('cache/saker-2025-2026.json'))['saker_liste']
S26=json.load(open('cache/saker-2026-2027.json'))['saker_liste']
H25=json.load(open('cache/horinger-2025-2026.json'))['horinger_liste']
H26=json.load(open('cache/horinger-2026-2027.json'))['horinger_liste']
PV=json.load(open('cache/parti_votering.json'))
SAK={str(x['id']):x for x in S25}
HOR={str(x['id']):x for x in H25}
VOT={}
for sid in PV:
    for v in json.load(open(f'cache/voteringer/{sid}.json'))['sak_votering_liste']: VOT[str(v['votering_id'])]=(sid,v)
def low(s): return (s or '').lower()
def sak_text(x): return low(x['tittel']+' '+(x['korttittel'] or '')+' '+x['henvisning']+' '+' '.join(e['navn'] for e in x['emne_liste']))
def hor_title(h): return ' '.join(low(i.get('sak_tittel'))+' '+low(i.get('sak_korttittel')) for i in h.get('horing_sak_info_liste') or [])
ALLTITLES=[low(x['tittel']+' '+(x['korttittel'] or '')) for x in S25+S26]+[hor_title(h) for h in H25+H26]
def fold(s):
    s=low(s).replace('æ','ae').replace('ø','o').replace('å','a')
    s=unicodedata.normalize('NFKD',s); s=''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9 ]',' ',s)).strip()
removed=collections.Counter(); notes=collections.Counter()
def drop(reason): removed[reason]+=1; return None
PARTI={'A':['ap','arbeiderpartiet','arbeidarpartiet','a'],'H':['h','hoyre','høyre'],'FrP':['frp','fremskrittspartiet'],'SV':['sv'],'Sp':['sp','senterpartiet'],'R':['rodt','rødt','r'],'MDG':['mdg','de gronne','miljopartiet'],'KrF':['krf','kristelig'],'V':['venstre','v']}
def parties_in(q):
    t=' '+fold(q)+' '; out=[]
    for p,al in PARTI.items():
        if any(f' {fold(a)} ' in t for a in al if len(a)>1 or a in('a','h','r','v') and False) : out.append(p)
    return out
def fix_facts(facts,text,min1=True,title=None):
    good=[f.lower() for f in facts if f and f.lower() in text]
    if len(good)<len(facts): notes['facts_repaired']+=1
    if not good and min1:
        words=[w for w in re.findall(r'[a-zæøå]{6,}',low(title or text))]
        if not words: return None
        good=[max(words,key=len)[:8]]; notes['facts_derived']+=1
    return good
HENV=re.compile(r'\b(prop|innst|dok|meld|dokument)\w*\.?\s*(\d+)\s*([a-z])?',re.I)
def check(cat,x):
    q=(x.get('query') or '').strip()
    if len(q)<2: return drop('empty_query')
    ids=[str(i) for i in (x.get('issueIds') or [])]
    facts=x.get('facts') or []; tmc=[t.lower() for t in (x.get('titleMustContain') or [])]
    base={'query':q,'category':cat}
    if cat=='finnes_ikke':
        if ids or x.get('hearingId'): return drop('finnes_ikke_has_gt')
        gen={'skatt','forbud','nasjonal','regulering','stemte','vedtak','hoyring','høring','lov','krav','stortinget','norge','norsk','ordning','nye','ny','plan','støtte','stotte','gratis','reduksjon','digital','strategi','bygg','satsing','statlig','offentlige','lokale','fjerning','obligatorisk','økt','okt','garanti','tilgjengelighet','utbygging','ungdom','barn','eldre','alle','innføring','innforing'}
        dist=[f.lower() for f in facts if f.lower() not in gen]
        words=[w for f in dist for w in fold(f).split() if len(w)>=5 and w not in {fold(g) for g in gen}]
        if not words: return drop('finnes_ikke_no_distinct_terms')
        longest=max(words,key=len)
        def hits(w,ft):
            stem=w[:max(6,len(w)-2)]
            return stem in ft or any(len(tw)>=10 and tw in w for tw in ft.split())
        for t in ALLTITLES:
            ft=fold(t)
            if all(hits(w,ft) for w in words) or (len(longest)>=8 and hits(longest,ft)):
                return drop('finnes_ikke_matches_existing_title')
        x_q=fold(q)
        for t in ALLTITLES:
            if len(t)>15 and difflib.SequenceMatcher(None,x_q,fold(t)[:len(x_q)+10]).ratio()>0.8: return drop('finnes_ikke_matches_existing_title')
        return {**base,'kind':'finnes_ikke','gold':{'facts':dist}}
    for i in ids:
        if i not in SAK: return drop('gt_sak_id_not_in_corpus')
    if cat=='eksakt_sak':
        if len(ids)!=1: return drop('eksakt_wrong_gt_count')
        s=SAK[ids[0]]; num=re.findall(r'\b(\d{5,6})\b',q)
        if num and ids[0] not in num: return drop('eksakt_id_mismatch')
        m=HENV.search(q)
        if m and not num:
            n=m.group(2); hv=low(s['henvisning'])
            if not re.search(r'\b'+n+r'\b',hv): return drop('eksakt_henvisning_mismatch')
            kind=m.group(1).lower()[:3]
            cnt=sum(1 for y in S25 if re.search(r'\b'+kind+r'\w*\.?\s*'+n+r'\b',low(y['henvisning'])))
            if cnt!=1: return drop('eksakt_henvisning_ambiguous')
        if not num and not m:
            qt=set(w for w in fold(q).split() if len(w)>=4); tt=fold(s['tittel']+' '+(s['korttittel'] or ''))
            if not any(w[:5] in tt for w in qt): return drop('eksakt_no_title_overlap')
        tmc=[t for t in tmc if t in low(s['tittel']+' '+(s['korttittel'] or ''))]
        g={'issueIds':ids}
        if tmc: g['titleMustContain']=tmc[:1]
        tags=['eksakt_sak']+(['exact_id'] if num else [])+(['year_format'] if m else [])
        return {**base,'kind':'issue_search','gold':g,'tags':tags}
    if cat=='tema':
        if len(ids)<2: return drop('tema_needs_2plus_saker')
        txt=' '.join(sak_text(SAK[i]) for i in ids)
        f=fix_facts(facts,txt,title=SAK[ids[0]]['tittel'])
        if f is None: return drop('no_valid_facts')
        return {**base,'kind':'topic','gold':{'facts':f[:1],'issueIds':ids[:4]},'tags':['tema','topic_multi_sak']}
    if cat=='prefiks_delord':
        p=fold(q).split()[-1] if q else ''
        if not (3<=len(p)<=9): return drop('prefix_bad_length')
        pl=q.lower().split()[-1]
        def has(s): return any(w.startswith(pl) for w in re.findall(r'[\wæøå-]+',low(s['tittel'])))
        valid=[i for i in ids if has(SAK[i])]
        if len(valid)<len(ids): notes['prefix_gt_recomputed']+=1
        allm=[str(y['id']) for y in S25 if has(y)]
        if not allm: return drop('prefix_matches_no_title')
        if any(w==pl for y in S25 for w in re.findall(r'[\wæøå-]+',low(y['tittel']))) and all(w==pl for y in S25 for w in re.findall(r'[\wæøå-]+',low(y['tittel'])) if w.startswith(pl)):
            return drop('prefix_is_full_word')
        return {**base,'kind':'issue_search','gold':{'titleMustContain':[pl],'issueIds':(valid or allm)[:5]},'tags':['prefiks_delord','prefix','friction_fts']}
    if cat=='sammensatte_ord':
        if len(ids)!=1: return drop('compound_wrong_gt_count')
        tt=low(SAK[ids[0]]['tittel']+' '+(SAK[ids[0]]['korttittel'] or ''))
        tmc=[t for t in tmc if t in tt]
        if not tmc: return drop('compound_titleMustContain_not_in_title')
        if not any(len(w)>=9 and tmc[0] in w or (len(tmc[0])>=5 and tmc[0] in w and w!=tmc[0]) or len(tmc[0])>=9 for w in re.findall(r'[\wæøå-]+',tt)): return drop('compound_no_compound_word')
        return {**base,'kind':'issue_search','gold':{'issueIds':ids,'titleMustContain':tmc[:1]},'tags':['sammensatte_ord','compound','friction_fts']}
    if cat=='voteringer_parti':
        vid=str(x.get('voteringId') or '')
        if len(ids)!=1: return drop('votering_wrong_gt_count')
        if vid not in VOT: return drop('votering_id_not_in_corpus')
        if VOT[vid][0]!=ids[0]: return drop('votering_sak_mismatch')
        v=PV[ids[0]]
        pos={}
        for p,c in v['parti'].items():
            f,m=c.get('2',0),c.get('3',0); pos[p]='for' if f>m else ('mot' if m>f else ('delt' if f else 'ikke_tilstede'))
        f=fix_facts(facts,sak_text(SAK[ids[0]]),title=SAK[ids[0]]['tittel'])
        if f is None: return drop('no_valid_facts')
        g={'facts':f[:1],'documentKinds':[],'voteringId':vid,'vedtatt':v['vedtatt'],'antallFor':v['for'],'antallMot':v['mot'],'partyPositions':pos}
        mp=parties_in(q)
        if mp: g['askedParties']=mp
        return {**base,'kind':'sak_chunk','issueId':ids[0],'gold':g,'tags':['voteringer_parti','party_votering']}
    if cat=='horinger':
        hid=str(x.get('hearingId') or '')
        if hid not in HOR: return drop('hearing_id_not_in_corpus')
        hs=[str(i['sak_id']) for i in HOR[hid].get('horing_sak_info_liste') or []]
        if ids and not set(ids)&set(hs): return drop('hearing_sak_mismatch')
        f=fix_facts(facts,hor_title(HOR[hid]),title=hor_title(HOR[hid]))
        if f is None: return drop('no_valid_facts')
        return {**base,'kind':'hearing_chunk','hearingId':hid,'gold':{'facts':f[:2],'documentKinds':[],'issueIds':hs},'tags':['horinger','hearing']}
items=[]
raw=0
for c in CATS:
    import os
    srcs=[f'cache/gen_{c}.json']+([f'cache/gen2_{c}.json'] if os.path.exists(f'cache/gen2_{c}.json') else [])
    for x in [x for f in srcs for x in json.load(open(f))['items']]:
        raw+=1; r=check(c,x)
        if r: items.append(r)
# dedup
seen=[];final=[];fcap=collections.Counter()
for it in items:
    n=fold(it['query'])
    if any(n==s for s in seen): removed['duplicate_exact_normalized']+=1; continue
    if any(difflib.SequenceMatcher(None,n,s).ratio()>=0.88 or (set(n.split())==set(s.split())) for s in seen): removed['near_duplicate']+=1; continue
    if it['category']=='finnes_ikke':
        fk='|'.join(sorted(fold(f)[:6] for f in it['gold']['facts']))
        fcap[fk]+=1
        if fcap[fk]>2: removed['finnes_ikke_same_topic_cap2']+=1; continue
    seen.append(n); final.append(it)
# ids
cc=collections.Counter()
for it in final:
    cc[it['category']]+=1; it['id']=f"v2-{it['category'].replace('_','-')}-{cc[it['category']]:03d}"
    t=it.setdefault('tags',[]); t.insert(0,'v2')
    if len(it['query'].split())<=4: t.append('short_query')
# group (no leakage): union-find on gt ids and near-identical queries
par=list(range(len(final)))
def f_(i):
    while par[i]!=i: par[i]=par[par[i]]; i=par[i]
    return i
def u(a,b): par[f_(a)]=f_(b)
def keys(it):
    k=set(it['gold'].get('issueIds',[]))
    if it.get('issueId'): k.add(it['issueId'])
    if it.get('hearingId'): k.add('H'+it['hearingId'])
    if it['category']=='finnes_ikke': k={'F'+'|'.join(sorted(fold(f)[:6] for f in it['gold']['facts']))}
    if it['category']=='prefiks_delord': k={'P'+it['gold']['titleMustContain'][0]}|set(it['gold']['issueIds'])
    return k
own={}
for i,it in enumerate(final):
    for k in keys(it):
        if k in own: u(i,own[k])
        else: own[k]=i
N=[fold(x['query']) for x in final]
for i in range(len(final)):
    for j in range(i+1,len(final)):
        if difflib.SequenceMatcher(None,N[i],N[j]).ratio()>=0.75: u(i,j)
groups=collections.defaultdict(list)
for i in range(len(final)): groups[f_(i)].append(i)
random.seed(42)
dev=set()
gl=list(groups.values()); random.shuffle(gl); gl.sort(key=len)
target={c:round(0.3*cc[c]) for c in CATS}
cur=collections.Counter()
for g in gl:
    cg=collections.Counter(final[i]['category'] for i in g)
    if all(cur[c]+n<=target[c]+1 for c,n in cg.items()) and any(cur[c]<target[c] for c in cg):
        dev|=set(g); cur.update(cg)
DEV=[final[i] for i in range(len(final)) if i in dev]; TEST=[final[i] for i in range(len(final)) if i not in dev]
# balance trim (even distribution): cap over-represented categories after split
CAP={'dev':{'tema':10,'finnes_ikke':11},'test':{'tema':24,'finnes_ikke':25}}
def trim(L,caps):
    out=[];cnt=collections.Counter();rng=random.Random(7);L2=L[:];rng.shuffle(L2);keep=set()
    for it in L2:
        c=it['category']
        if c in caps and cnt[c]>=caps[c]: removed['category_balance_trim']+=1; continue
        cnt[c]+=1; keep.add(it['id'])
    return [it for it in L if it['id'] in keep]
DEV=trim(DEV,CAP['dev']); TEST=trim(TEST,CAP['test'])
final=DEV+TEST
# leakage check
def allkeys(L): return set(k for it in L for k in keys(it))
leak=allkeys(DEV)&allkeys(TEST)
nd=[(a['id'],b['id']) for a in DEV for b in TEST if difflib.SequenceMatcher(None,fold(a['query']),fold(b['query'])).ratio()>=0.75]
order=['id','kind','category','query','issueId','hearingId','gold','tags']
def ordd(it): return {k:it[k] for k in order if k in it}
json.dump([ordd(x) for x in TEST],open('out/questions-v2-test.json','w'),ensure_ascii=False,indent=2)
json.dump([ordd(x) for x in DEV],open('out/questions-v2-dev.json','w'),ensure_ascii=False,indent=2)
used_s=sorted({k for it in final for k in keys(it) if k.isdigit()},key=int)
used_h=sorted({it['hearingId'] for it in final if it.get('hearingId')},key=int)
used_v=sorted({it['gold']['voteringId'] for it in final if it['gold'].get('voteringId')},key=int)
snap={'generatedAt':'2026-10-19','source':'data.stortinget.no','sessionId':'2025-2026',
 'rawExports':{'saker':'https://data.stortinget.no/eksport/saker?sesjonid=2025-2026&format=json','horinger':'https://data.stortinget.no/eksport/horinger?sesjonid=2025-2026&format=json','voteringer':'https://data.stortinget.no/eksport/voteringer?sakid=<id>&format=json','voteringsresultat':'https://data.stortinget.no/eksport/voteringsresultat?voteringid=<id>&format=json','finnesIkkeCheckedAgainst':['saker 2025-2026','saker 2026-2027','horinger 2025-2026','horinger 2026-2027']},
 'corpusCounts':{'saker2025_2026':len(S25),'horinger2025_2026':len(H25),'saker2026_2027':len(S26),'horinger2026_2027':len(H26)},
 'issues':[{'id':i,'tittel':SAK[i]['tittel'],'henvisning':SAK[i]['henvisning'],'komite':(SAK[i]['komite'] or {}).get('navn')} for i in used_s],
 'hearings':[{'id':h,'sakIds':[str(i['sak_id']) for i in HOR[h].get('horing_sak_info_liste') or []],'tittel':hor_title(HOR[h]).strip(),'komite':(HOR[h].get('komite') or {}).get('navn'),'status':HOR[h].get('horing_status')} for h in used_h],
 'voteringer':[{'id':v,'sakId':VOT[v][0],'tema':VOT[v][1]['votering_tema'],'vedtatt':VOT[v][1]['vedtatt']} for v in used_v]}
json.dump(snap,open('out/corpus-v2-snapshot.json','w'),ensure_ascii=False,indent=2)
json.dump({'sessionId':'2025-2026','coreIssues':used_s,'hearings':used_h,'distractorCount':12,'maxDocumentsPerIssue':2,'maxPublicationChars':120000},open('out/corpus-v2.json','w'),ensure_ascii=False,indent=2)
rep={'raw':raw,'afterGtValidation':len(items),'final':len(final),'removed':dict(removed),'removedTotal':raw-len(final),'repairs':dict(notes),
 'dev':dict(collections.Counter(x['category'] for x in DEV)),'test':dict(collections.Counter(x['category'] for x in TEST)),'devTotal':len(DEV),'testTotal':len(TEST),
 'leakageSharedIds':sorted(leak),'leakageNearDupPairs':nd,'groups':len(groups),'largestGroup':max(map(len,groups.values())),
 'usedIssues':len(used_s),'usedHearings':len(used_h),'usedVoteringer':len(used_v)}
json.dump(rep,open('out/validation-report.json','w'),ensure_ascii=False,indent=2)
print(json.dumps(rep,ensure_ascii=False,indent=1))
