import { usePbnTranslations } from "@/i18n/useTranslations";
import React from 'react';
import { Link as LinkIcon, Video as VideoIcon, Music as MusicIcon } from 'lucide-react';
import { InsertForm } from './InsertForm';
export const LinkTool = ({
  editor,
  disabled
}) => {
  const pbnT = usePbnTranslations();
  return <InsertForm title={pbnT("m1340")} placeholder={pbnT("m1341")} Icon={LinkIcon} disabled={disabled} onConfirm={url => editor.insertText('[', `](${url})`)} />;
};
export const VideoTool = ({
  editor,
  disabled
}) => {
  const pbnT = usePbnTranslations();
  return <InsertForm title={pbnT("m1342")} placeholder={pbnT("m1343")} Icon={VideoIcon} disabled={disabled} onConfirm={url => editor.insertBlock(`\n::video{src="${url}" width="100%"}\n`)} />;
};
export const AudioTool = ({
  editor,
  disabled
}) => {
  const pbnT = usePbnTranslations();
  return <InsertForm title={pbnT("m1344")} placeholder={pbnT("m1345")} Icon={MusicIcon} disabled={disabled} onConfirm={url => editor.insertBlock(`\n::audio{src="${url}" width="100%"}\n`)} />;
};
