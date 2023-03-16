import type { PHPResponse } from '@wp-playground/php-wasm-web';

export function asDOM(response: PHPResponse) {
  return new DOMParser().parseFromString(asText(response), 'text/html')!;
}

export function asText(response: PHPResponse) {
  return new TextDecoder().decode(response.body);
}

export function zipNameToHumanName(zipName: string) {
  const mixedCaseName = zipName.split('.').shift()!.replace('-', ' ');
  return (
    mixedCaseName.charAt(0).toUpperCase() + mixedCaseName.slice(1).toLowerCase()
  );
}
