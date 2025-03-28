/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in ms
 * @returns The result of the function
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> => {
    let retries = 0;
  
    while (true) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          throw error;
        }
  
        const delay = initialDelay * Math.pow(2, retries - 1);
        console.log(`Attempt ${retries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };