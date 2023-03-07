import { useState, useEffect } from 'react'

export function useDeferredValue(promise) {
	const [value, setValue] = useState(null)
	useEffect(() => {
		promise.then(setValue)
	}, [promise])
	return value
}
