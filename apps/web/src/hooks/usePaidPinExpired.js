'use client';

import {useEffect,useState} from 'react';

/** One deadline timer per rendered surface — no polling or privilege extension. */
export function useDeadlineExpired(expiresAt,serverNow){
  const [expired,setExpired]=useState(false);
  useEffect(()=>{
    setExpired(false);if(!expiresAt)return;
    const remaining=Math.min(new Date(expiresAt)-new Date(serverNow),new Date(expiresAt)-Date.now());
    if(!Number.isFinite(remaining)||remaining<=0){setExpired(true);return;}
    const deadline=Date.now()+remaining;let timer;
    const check=()=>{clearTimeout(timer);const left=deadline-Date.now();if(left<=0)setExpired(true);else timer=setTimeout(check,Math.min(left,2147483647));};
    check();document.addEventListener('visibilitychange',check);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',check);};
  },[expiresAt,serverNow]);
  return expired;
}

// Paid-pin placement deadline (topic.pinExpiresAt).
export function usePaidPinExpired(topic){
  return useDeadlineExpired(topic?.pinExpiresAt,topic?.pinServerNow);
}
