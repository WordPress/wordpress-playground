const query = new URL(location.href).searchParams;
document.getElementById('playground-iframe').src = query.get('next');

window.addEventListener('message', (event) => {
	console.log('message received', event);
});
