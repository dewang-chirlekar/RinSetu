'use client';

/**
 * src/components/ScrollReveal.tsx
 *
 * The one client component in the app, and it renders nothing. It exists to make
 * the front page's scroll reveal work in every browser rather than only in the
 * ones that ship CSS scroll-driven animations, which was the first attempt and
 * was invisible in most of them.
 *
 * It is a scroll listener and a rectangle comparison. No IntersectionObserver, no
 * requestAnimationFrame, nothing that needs a polyfill or a second code path —
 * there are ten elements to check and this has to be debuggable at 2am.
 *
 * The ordering in the effect is the whole point, so please do not rearrange it:
 *
 *   1. Sweep FIRST, while the blur does not exist yet, so everything already on
 *      screen is marked revealed.
 *   2. Only then set html[data-reveal-ready], which is what switches the blur on
 *      for whatever is left (see "Motion" in src/app/globals.css).
 *
 * In that order nothing the reader can see is ever blurred, not even for a frame.
 * In the other order the whole page flickers on load.
 *
 * The blur lives behind that one attribute and nowhere else, so every way this can
 * fail — scripting disabled, a script error, reduced motion, a browser from 2013 —
 * leaves a plain, sharp, readable page. That is deliberate: this is decoration,
 * and decoration is never allowed to hide content in an app whose subject is
 * whether someone qualifies for a loan.
 */

import { useEffect } from 'react';

/**
 * The reveal line, as a fraction of the viewport height. One constant on purpose:
 * "already seen, never blur it" and "scrolled far enough, reveal it" are the same
 * question, so they must not be able to drift apart and strand an element between
 * two slightly different thresholds.
 */
const REVEAL_LINE = 0.9;

export function ScrollReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (items.length === 0) return;

    let pending = items;

    // Declared as hoisted functions, not consts: sweep() runs before detach() is
    // reached, and can call it on a page short enough to reveal everything at once.
    function sweep() {
      const line = window.innerHeight * REVEAL_LINE;
      pending = pending.filter((item) => {
        if (item.getBoundingClientRect().top >= line) return true;
        item.dataset.revealed = 'true';
        return false;
      });
      if (pending.length === 0) detach();
    }

    function detach() {
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
    }

    sweep();
    document.documentElement.dataset.revealReady = 'true';

    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep);

    return detach;
  }, []);

  return null;
}
