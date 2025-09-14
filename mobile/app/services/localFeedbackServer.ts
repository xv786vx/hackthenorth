// Expo/React Native cannot host a Node http server. Provide a no-op shim.
export const startLocalFeedbackServer = () => {
  console.log('localFeedbackServer is a no-op in Expo. Use the backend callback instead.');
  return null as any;
};


