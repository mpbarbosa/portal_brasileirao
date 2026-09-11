/**
 * Whether a click on a real `<a href>` is the app's to route.
 *
 * Only a plain primary-button click is. Cmd/ctrl-click, shift-click, alt-click
 * and any other button belong to the browser — a new tab, a new window, a
 * download — and swallowing them is how a link comes to behave worse than the
 * plain anchor it replaced.
 *
 * **It is one function because it was written out by hand at every in-app
 * link**, and the copies had already drifted: two of them tested the four
 * modifier keys and never the button. A lookup this small is still a fact with
 * one right answer, and the second copy is where drift starts.
 *
 * Structural rather than `React.MouseEvent`, so the unit test can hand it a
 * plain object and a DOM `MouseEvent` satisfies it too.
 */
export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}

export const isPlainClick = (event: ClickModifiers): boolean =>
  !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
