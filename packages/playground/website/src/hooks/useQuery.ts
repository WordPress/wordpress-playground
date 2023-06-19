
/**
 * @description: Custom hook to get the query params from the URL.
 * @param {string} paramName - The name of the query param.
 * @returns {string | null} The value of the query param if found, null otherwise.
*/
const useQuery = (paramName: string): string | null => {
  // Get the query params from the URL.
  const queryParams = window.location.search;
  
  // Get the value of the query param.
  const value = new URLSearchParams(queryParams).get(paramName);
  
  // If the value is found, return it.
  if(value) return value;
  
  // If the value is not found, return null.
  return null 
};

export default useQuery;