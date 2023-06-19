import React from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './css/toast.css';

/**
 * @description: This component shows a toast message to the user when the component is mounted.
 * @argument: None
 * @returns: None
*/
const Toast: React.FC = () => {
	
	// The toast message to show to the user when the application loads for the first time.
	const TOAST_MESSAGE = 'All of your modification are private, and will be lost after a page refresh!';

	/**
	 * @description: This function shows a custom toast message to the user when the component is mounted.
	 * @argument: message: string
	 * @returns: None
	*/
	const showToastMessage = (message: string) => {
		/**
		 * @description: This function shows a toast message to the user.
		 * @argument: message: string, options: object
		 * @returns: None
		 * @see: https://fkhadra.github.io/react-toastify/introduction/
		*/
		toast.info(message, {
				autoClose: 20000,
				position: toast.POSITION.BOTTOM_CENTER
		});
	};
	
	/**
	 * @description: This is a React hook. It's a function that runs when the component is mounted.
	 * In this case, we're using it to show the toast message.
	*/
	React.useEffect(()=> {
		// Show the toast message.
		showToastMessage(TOAST_MESSAGE);
	}, [])

	return (
		<div>
				<ToastContainer className="toast-container"/>
		</div>
	);
}

export default Toast;