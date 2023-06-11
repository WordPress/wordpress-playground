import React from 'react';
import './css/modal-css.css';

/**
 * @title Modal component
 * @param {React.ReactElement} children
 * @returns {React.ReactElement}
 * @description Custom Modal component to display a modal content based on the children passed.
*/
const Modal = ({ children }: { children: React.ReactElement }) => {
  
  /**
   * @description Function to close the modal
   * @returns {void}
  */
  const onClick = (): void => {
    const modal = document.getElementById('custom_modal') as HTMLElement;
    
    // if modal is not null, set the display to none
    if(modal){
      modal.style.display = 'none';
    }
  }

  /**
   * @description Function to open the modal
   * @returns React.ReactElement
  */
  return (
    <div id="custom_modal" className="modal">
      <div className="modal_content">
        <div className='content_block'>
          {children}
        </div>
        <div className='close_section'>
          <span className="close" onClick={onClick}>&times;</span>
        </div>
      </div>
    </div>
  );
};

export default Modal;