// Tailwind tries to load lightningcss native bindings when available; disable to avoid missing binary in hosted builds.
if (process.env.TAILWIND_DISABLE_LIGHTNINGCSS === undefined) {
  process.env.TAILWIND_DISABLE_LIGHTNINGCSS = "1";
}

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
