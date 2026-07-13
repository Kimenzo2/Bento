<script lang="ts">
  import {
    siNetflix,
    siSpotify,
    siYoutube,
    siClaude,
    siCursor,
    siNotion,
    siFigma,
    siLinear,
    siGithub,
    siGithubcopilot,
    siIcloud,
    siApplemusic,
    siPerplexity,
    siDuolingo,
    siZoom,
    siX,
    siDropbox,
    siHeadspace,
    siDeepseek,
    siGooglegemini,
  } from 'simple-icons';
  import { EXTRA_SVGS } from './brand-svgs';

  let {
    name = '',
    size = 16,
    class: className = '',
  }: { name?: string; size?: number; class?: string } = $props();

  const key = $derived(
    name.toLowerCase()
      .replace(/[\s-]+/g, '')
      .replace(/[^a-z0-9]/g, '')
  );

  // Wrap SVG string in a container with explicit size
  function renderSvg(svg: string, size: number, className: string, label: string): string {
    // Inject width/height into the opening <svg> tag
    const sized = svg.replace(/<svg/, `<svg width="${size}" height="${size}"`);
    return `<span class="${className}" style="display:inline-flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;flex-shrink:0" aria-label="${label}" role="img">${sized}</span>`;
  }
</script>

{#if !name}
  <span />
{:else if key === 'netflix' || key === 'netflixcopilot'}
  {@html renderSvg(siNetflix.svg, size, className, name)}
{:else if key === 'spotify'}
  {@html renderSvg(siSpotify.svg, size, className, name)}
{:else if key === 'youtube' || key === 'youtubepremium'}
  {@html renderSvg(siYoutube.svg, size, className, name)}
{:else if key === 'claude' || key === 'anthropic'}
  {@html renderSvg(siClaude.svg, size, className, name)}
{:else if key === 'cursor'}
  {@html renderSvg(siCursor.svg, size, className, name)}
{:else if key === 'notion'}
  {@html renderSvg(siNotion.svg, size, className, name)}
{:else if key === 'figma'}
  {@html renderSvg(siFigma.svg, size, className, name)}
{:else if key === 'linear'}
  {@html renderSvg(siLinear.svg, size, className, name)}
{:else if key === 'github'}
  {@html renderSvg(siGithub.svg, size, className, name)}
{:else if key === 'githubcopilot'}
  {@html renderSvg(siGithubcopilot.svg, size, className, name)}
{:else if key === 'applemusic'}
  {@html renderSvg(siApplemusic.svg, size, className, name)}
{:else if key === 'icloud' || key === 'icloud+'}
  {@html renderSvg(siIcloud.svg, size, className, name)}
{:else if key === 'perplexity'}
  {@html renderSvg(siPerplexity.svg, size, className, name)}
{:else if key === 'deepseek'}
  {@html renderSvg(siDeepseek.svg, size, className, name)}
{:else if key === 'duolingo'}
  {@html renderSvg(siDuolingo.svg, size, className, name)}
{:else if key === 'zoom'}
  {@html renderSvg(siZoom.svg, size, className, name)}
{:else if key === 'twitter' || key === 'x'}
  {@html renderSvg(siX.svg, size, className, name)}
{:else if key === 'dropbox'}
  {@html renderSvg(siDropbox.svg, size, className, name)}
{:else if key === 'headspace'}
  {@html renderSvg(siHeadspace.svg, size, className, name)}
{:else if key === 'gemini'}
  {@html renderSvg(siGooglegemini.svg, size, className, name)}
{:else if key === 'chatgpt' || key === 'openai' || key === 'openaichatgpt'}
  {@html renderSvg(EXTRA_SVGS.openai, size, className, name)}
{:else if key === 'grok'}
  {@html renderSvg(EXTRA_SVGS.grok, size, className, name)}
{:else if key === 'slack'}
  {@html renderSvg(EXTRA_SVGS.slack, size, className, name)}
{:else if key === 'linkedin'}
  {@html renderSvg(EXTRA_SVGS.linkedin, size, className, name)}
{:else if key === 'adobe' || key === 'adobecreativecloud'}
  {@html renderSvg(EXTRA_SVGS.adobe, size, className, name)}
{:else if key === 'midjourney'}
  {@html renderSvg(EXTRA_SVGS.midjourney, size, className, name)}
{:else}
  <!-- Fallback: first letter when no SVG available -->
  <span style="font-size: {size}px; line-height: 1; font-weight: 700;" class={className}>
    {name.charAt(0).toUpperCase()}
  </span>
{/if}
