import { SUBMIT_PROTEST_FORM_URL } from "./config.js";
import {
  submitProtestDialogElement,
  submitFormFrameElement,
  submitFormEmptyElement,
} from "./dom-refs.js";

/*
 * The "Shto një protestë" dialog: an in-page bottom sheet (not a
 * separate page) embedding the Google Form, or a setup notice if
 * SUBMIT_PROTEST_FORM_URL hasn't been configured yet.
 */

let formLoaded = false;

function ensureFormLoaded() {
  if (formLoaded) {
    return;
  }

  formLoaded = true;

  if (SUBMIT_PROTEST_FORM_URL) {
    if (submitFormFrameElement instanceof HTMLIFrameElement) {
      submitFormFrameElement.src = SUBMIT_PROTEST_FORM_URL;
      submitFormFrameElement.hidden = false;
    }

    submitFormEmptyElement?.setAttribute("hidden", "");
  } else {
    submitFormFrameElement?.setAttribute("hidden", "");
    submitFormEmptyElement?.removeAttribute("hidden");
  }
}

export function openSubmitDialog() {
  if (!(submitProtestDialogElement instanceof HTMLDialogElement)) {
    return;
  }

  // The Google Form iframe is only pointed at its real src the first
  // time the dialog opens, so it doesn't cost anything on initial page
  // load and a closed/reopened dialog doesn't lose in-progress input.
  ensureFormLoaded();

  if (!submitProtestDialogElement.open) {
    submitProtestDialogElement.showModal();
  }

  requestAnimationFrame(() => {
    submitProtestDialogElement.classList.add("is-open");
  });
}

export function closeSubmitDialog() {
  if (!(submitProtestDialogElement instanceof HTMLDialogElement)) {
    return;
  }

  submitProtestDialogElement.classList.remove("is-open");

  if (submitProtestDialogElement.open) {
    submitProtestDialogElement.close();
  }
}
