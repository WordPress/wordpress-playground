const htmlToText = (html) => {
	const node = document.createElement('div');
	node.innerHTML = html;

	node.querySelectorAll('b, strong').forEach(
		(fontNode) => (fontNode.innerHTML = `**${fontNode.innerHTML}**`)
	);

	node.querySelectorAll('i, em').forEach(
		(fontNode) => (fontNode.innerHTML = `//${fontNode.innerHTML}//`)
	);

	node.querySelectorAll('code').forEach(
		(codeNode) => (codeNode.innerHTML = `\`${codeNode.innerHTML}\``)
	);

	node.querySelectorAll('a').forEach(
		(linkNode) =>
			(linkNode.outerHTML = `[${linkNode.getAttribute('href')} ${
				linkNode.innerText
			}]`)
	);

	return node.innerText;
};

const blockToTrac = (state, block) => {
	/**
	 * Convert a number to Roman Numerals.
	 *
	 * @cite https://stackoverflow.com/a/9083076/486538
	 */
	const romanize = (num) => {
		const digits = String(+num).split('');
		const key = [
			'',
			'C',
			'CC',
			'CCC',
			'CD',
			'D',
			'DC',
			'DCC',
			'DCCC',
			'CM',
			'',
			'X',
			'XX',
			'XXX',
			'XL',
			'L',
			'LX',
			'LXX',
			'LXXX',
			'XC',
			'',
			'I',
			'II',
			'III',
			'IV',
			'V',
			'VI',
			'VII',
			'VIII',
			'IX',
		];
		let roman = '';
		let i = 3;
		while (i--) {
			roman = (key[+digits.pop() + i * 10] || '') + roman;
		}
		return Array(+digits.join('') + 1).join('M') + roman;
	};

	switch (block.name) {
		case 'core/quote':
			const content = blocksToTrac(state, block.innerBlocks);
			return (
				content
					.split(/\n/g)
					.map((l) => `> ${l}`)
					.join('\n') + '\n\n'
			);

		case 'core/code':
			const code = htmlToText(block.attributes.content);
			const languageSpec = code.startsWith('<?php') ? `#!php` : '';
			return `{{{${languageSpec}\n${code}\n}}}\n\n`;

		case 'core/heading':
			return (
				'='.repeat(block.attributes.level) +
				' ' +
				htmlToText(block.attributes.content) +
				'\n\n'
			);

		case 'core/list':
			state.indent++;
			state.listStyle.push({
				style: block.attributes.ordered
					? block.attributes.type || 'decimal'
					: '-',
				count: block.attributes.start || 1,
			});
			const list = blocksToTrac(state, block.innerBlocks);
			state.listStyle.pop();
			state.indent--;
			return `${list}\n\n`;

		case 'core/list-item':
			if (0 === state.listStyle.length) {
				return '';
			}

			const item = state.listStyle[state.listStyle.length - 1];
			const bullet = (() => {
				switch (item.style) {
					case '-':
						return '-';

					case 'decimal':
						return `${item.count.toString()}.`;

					case 'upper-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet =
								'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(count - 1) % 26] +
								bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'lower-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet =
								'abcdefghijklmnopqrstuvwxyz'[(count - 1) % 26] +
								bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'upper-roman':
						return romanize(item.count) + '.';

					case 'lower-roman':
						return romanize(item.count).toLowerCase();

					default:
						return `${item.count.toString()}.`;
				}
			})();

			item.count++;

			return `${'\t'.repeat(state.indent)}${bullet} ${htmlToText(
				block.attributes.content
			)}\n`;

		case 'core/paragraph':
			if ('undefined' === typeof window.lastContent) {
				window.lastContent = block.attributes.content;
			}
			console.log(window.lastContent);
			return htmlToText(block.attributes.content) + '\n\n';

		case 'core/separator':
			return '\n----\n\n';

		default:
			return '';
	}
};

const blocksToTrac = (state, blocks) => {
	return blocks
		.map((block) => blockToTrac(state, block))
		.join('')
		.replace(/^[\n\r]+|[\n\r]+$/g, '');
};

export const blocks2trac = (blocks) => {
	const state = {
		indent: 0,
		listStyle: [],
	};

	return blocksToTrac(state, blocks || []);
};
