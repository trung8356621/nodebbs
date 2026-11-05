import {redirect} from 'next/navigation';

/** Legacy pins admin URL — commercial admin lives under Currency management. */
export default function LegacyPins(){
  redirect('/dashboard/ledger?tab=services');
}
