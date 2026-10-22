import MarkdownRender from '@/components/common/MarkdownRender';

/**
 * 话题正文内容渲染
 * 原子组件，纯展示
 *
 * @param {Object} props
 * @param {string} props.content - Markdown 内容
 */
export default function TopicBody({ content, topic }) {
  return (
    <article className='max-w-none prose prose-stone dark:prose-invert break-all'>
      <MarkdownRender content={content} linkPolicy={topic?.linkPolicy} canonicalOrigin={topic?.canonicalOrigin} pinExpiresAt={topic?.pinExpiresAt} pinServerNow={topic?.pinServerNow} />
    </article>
  );
}
