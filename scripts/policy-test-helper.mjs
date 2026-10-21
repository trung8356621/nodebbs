export async function waitApis(configs) {
  await Promise.all(configs.map(async c=>{
    const end=Date.now()+60000;
    while(Date.now()<end) {
      try {if((await fetch(`http://127.0.0.1:${c.apiPort}/api`,{signal:AbortSignal.timeout(2000)})).status===200)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    throw new Error('API unavailable: '+c.id);
  }));
}
