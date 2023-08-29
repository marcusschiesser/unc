declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY?: string;
      BASE_URL?: string;
      VERCEL?: string;
      DISABLE_GPT4?: string; // allow user to use gpt-4 or not
      BUILD_MODE?: "standalone" | "export";
      BUILD_APP?: string; // is building desktop app
    }
  }
}

export const getServerSideConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.BASE_URL,
    isVercel: !!process.env.VERCEL,
    disableGPT4: !!process.env.DISABLE_GPT4,
  };
};
