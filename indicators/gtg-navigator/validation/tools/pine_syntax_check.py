# Per-statement Pine syntax parse with pynescript (pip install pynescript). Syntax only:
# it is NOT a TradingView compile and knows nothing of Pine v6 semantics or types.
# Usage: python pine_syntax_check.py indicators/gtg-navigator/gtg_navigator_v0.4.7.pine
import sys, signal, time
from pynescript.ast import parse
path = sys.argv[1]
L = open(path, encoding='utf-8').read().split('\n')
hdr_end = next(i for i,l in enumerate(L) if l.startswith(')'))  # indicator(...) closer
stmts=[]; cur=None
for i,l in enumerate(L):
    if i <= hdr_end: continue
    if l and not l[0].isspace() and not l.startswith('//') and not l.startswith(')') and not l.startswith('else'):
        if cur: stmts.append(cur)
        cur=[i,[l]]
    elif cur is not None:
        cur[1].append(l)
if cur: stmts.append(cur)
hdr='//@version=5\nindicator("t")\n'
class TO(Exception): pass
def h(*a): raise TO()
signal.signal(signal.SIGALRM,h)
bad=0; slow=[]
signal.alarm(60)
parse('\n'.join(L[:hdr_end+1])+'\n'); signal.alarm(0); print('header OK', flush=True)
for start,body in stmts:
    n_else = sum(1 for x in body if x.startswith('else'))
    blocks=[body]
    if n_else >= 6:   # parser is exponential on long else-if chains: check each branch as an if
        blocks=[]; b=[]
        for x in body:
            if not x.startswith(' ') and b: blocks.append(b); b=[]
            b.append(x[5:] if x.startswith('else if ') else ('if true' if x.strip()=='else' else x))
        blocks.append(b)
    for blk in blocks:
        signal.alarm(120)
        try:
            t=time.time(); parse(hdr+'\n'.join(blk)+'\n'); dt=time.time()-t
            if dt>10: print(f"SLOW {dt:.0f}s line {start+1}: {blk[0][:60]}",flush=True)
        except TO: print(f"TIMEOUT line {start+1}: {blk[0][:70]}",flush=True); bad+=1
        except Exception as e: print(f"FAIL line {start+1}: {blk[0][:70]} :: {str(e)[:300]}",flush=True); bad+=1
        finally: signal.alarm(0)
print(f"DONE {len(stmts)} statements, {bad} problems",flush=True)
