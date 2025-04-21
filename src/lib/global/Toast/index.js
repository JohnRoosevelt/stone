// @ts-nocheck
import { toast } from '@zerodevx/svelte-toast'
import Success from "./Success.svelte";
import Info from "./Info.svelte";
import Error from "./Error.svelte";

export const success = m => toast.push({
  component: {
    src: Success,
    props: {
      message: m
    },
    sendIdTo: 'toastId'
  },
  duration: 3000,
  theme: {
    "--toastBackground":
      "linear-gradient(0deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%), #1DB51D;",
    "--toastBorderRadius": "16px",
    "--toastColor": "#000",
    "--toastBorder": "1px solid rgba(29, 181, 29, 0.32)",
    // '--toastBtnWidth': '0px',
    "--toastBarHeight": "0px",
  }
})

export const info = m => toast.push({
  component: {
    src: Info,
    props: {
      message: m
    },
    sendIdTo: 'toastId'
  },
  duration: 3000,
  theme: {
    "--toastBackground":
      "linear-gradient(0deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%), #2F75FE;",
    "--toastBorderRadius": "16px",
    "--toastColor": "#000",
    "--toastBorder": "1px solid rgba(47, 117, 254, 0.32)",
    // '--toastBtnWidth': '0px',
    "--toastBarHeight": "0px",
  }
})

export const error = m => toast.push({
  component: {
    src: Error,
    props: {
      message: m
    },
    sendIdTo: 'toastId'
  },
  duration: 3000,
  theme: {
    "--toastBackground":
      "linear-gradient(0deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%), #F51414;",
    "--toastBorderRadius": "16px",
    "--toastColor": "#000",
    "--toastBorder": "1px solid rgba(245, 20, 20, 0.32)",
    // '--toastBtnWidth': '0px',
    "--toastBarHeight": "0px",
  }
})


export const updater = m => toast.push({
  component: {
    src: Info,
    props: {
      message: m
    },
    sendIdTo: 'toastId'
  },
  duration: 3000,
  theme: {
    "--toastBackground":
      "linear-gradient(0deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%), #2F75FE;",
    "--toastBorderRadius": "16px",
    "--toastColor": "#000",
    "--toastBorder": "1px solid rgba(47, 117, 254, 0.32)",
    // '--toastBtnWidth': '0px',
    "--toastBarHeight": "1px",
  },
  initial: 0,
  next: 0,
  dismissable: false,
})