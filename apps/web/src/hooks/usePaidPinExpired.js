'use client';

import {useEffect,useState} from 'react';
// One deadline timer per rendered topic, with no polling or privilege extension.
export function usePaidPinExpired(topic){
  const [expired,setExpired]=useState(false);
  useEffect(()=>{
    setExpired(false);if(!topic.pinExpiresAt)return;
    const remaining=Math.min(new Date(topic.pinExpiresAt)-new Date(topic.pinServerNow),new Date(topic.pinExpiresAt)-Date.now());
    if(!Number.isFinite(remaining)||remaining<=0){setExpired(true);return;}
    const deadline=Date.now()+remaining;let timer;
    const check=()=>{clearTimeout(timer);const left=deadline-Date.now();if(left<=0)setExpired(true);else timer=setTimeout(check,Math.min(left,2147483647));};
    check();document.addEventListener('visibilitychange',check);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',check);};
  },[topic.pinExpiresAt,topic.pinServerNow]);
  return expired;
}
