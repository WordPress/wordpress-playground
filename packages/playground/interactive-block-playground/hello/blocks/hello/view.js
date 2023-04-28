// Disclaimer: Importing the `store` using a global is just a temporary solution.
const { store } = window.__experimentalInteractivity;

store({
  actions: {
    hello: {
      log: () => {
        console.log("hello!");
      },
    },
  },
});
