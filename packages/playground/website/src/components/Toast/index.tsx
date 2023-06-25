import React from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './css/toast.css';
import useQuery from '../../hooks/useQuery';

const Toast: React.FC = () => {
  const onBoarding = useQuery('onBoarding');
  const [showToast, setShowToast] = React.useState(false);
  const TOAST_MESSAGE = 'All of your modification are private, and will be lost after a page refresh!';

	const showToastMessage = (message: string): void => {
		/**
		 * @param message: string, options: object
		 * @see https://fkhadra.github.io/react-toastify/introduction/
		*/
		toast.info(message, {
				autoClose: 20000,
				position: toast.POSITION.BOTTOM_CENTER
		});
	};
	
  React.useEffect(() => {
		if (onBoarding && parseInt(onBoarding) === 1) {
			// Get the isOnboarded flag value from browser's local storage.
	    const isOnboarded = window.localStorage.getItem('isOnboarded');
			
      if (!isOnboarded) {
				window.localStorage.setItem('isOnboarded', "1")
				setShowToast(true);
        showToastMessage(TOAST_MESSAGE);
			} else {
				setShowToast(false);
			}
		}
	}, [onBoarding]);

	return (
    <div>{
      showToast && (
        <ToastContainer className="toast-container"/>
      )}
    </div>
	);
}

export default Toast;