const fileSystem = {
    '/': {
        'home': {},
        'etc': {},
        'var': {},
        'usr': {},
        'file.txt': 'This is a file.',
        'file1.txt': 'This is the content of file1.txt.'
    },
    '/home': {
        'user': {}
    },
    '/home/user': {
        'document.txt': 'This is a document in the user home directory.'
    }
};

const tarballContent = [
    'image1.png', 'image2.png', 'image3.png', 'document1.txt', 'document2.txt',
    'document3.txt', 'image4.png', 'document4.txt', 'image5.png', 'document5.txt',
    'image6.png', 'document6.txt', 'image7.png', 'document7.txt', 'image8.png',
    'document8.txt', 'image9.png', 'document9.txt', 'image10.png', 'document10.txt',
    'image11.png', 'document11.txt', 'image12.png', 'document12.txt', 'image13.png',
    'document13.txt', 'image14.png', 'document14.txt', 'image15.png', 'document15.txt'
];

let currentDir = '/';
let executedLs = false;
let executedCat = false;

function getPathParts(path) {
    return path.split('/').filter(part => part.length > 0);
}

function resolvePath(path) {
    if (path === '/') return '/';
    const parts = getPathParts(path);
    let resolvedPath = currentDir === '/' ? [] : getPathParts(currentDir);
    for (const part of parts) {
        if (part === '..') {
            resolvedPath.pop();
        } else if (part !== '.') {
            resolvedPath.push(part);
        }
    }
    return '/' + resolvedPath.join('/');
}

function getDirContent(path) {
    const parts = getPathParts(path);
    let dir = fileSystem['/'];
    for (const part of parts) {
        if (dir[part]) {
            dir = dir[part];
        } else {
            return null;
        }
    }
    return dir;
}

function checkCompletion() {
    if (executedLs && executedCat) {
        document.getElementById('completionMessage').classList.remove('hidden');
    }
}

function handleCommand(command) {
    const outputElem = document.getElementById('output');
    const inputElem = document.getElementById('input');
    let output = '';
    const [cmd, ...args] = command.trim().split(' ');

    outputElem.innerHTML += `<div>${document.getElementById('prompt').textContent} ${command}</div>`;

    switch (cmd) {
        case 'ls':
            const content = getDirContent(currentDir);
            if (content) {
                output = Object.keys(content).join(' ');
                executedLs = true;
                checkCompletion();
            } else {
                output = `ls: cannot access '${currentDir}': No such file or directory`;
            }
            break;
        case 'cd':
            if (args.length > 0) {
                const newPath = resolvePath(args[0]);
                if (getDirContent(newPath)) {
                    currentDir = newPath;
                } else {
                    output = `cd: ${args[0]}: No such file or directory`;
                }
            }
            break;
        case 'cat':
            if (args.length > 0) {
                const filePath = resolvePath(args[0]);
                const dir = getDirContent(filePath);
                if (typeof dir === 'string') {
                    output = dir;
                    if (args[0] === 'file1.txt') {
                        executedCat = true;
                        checkCompletion();
                    }
                } else {
                    output = `cat: ${args[0]}: No such file or directory`;
                }
            }
            break;
        case 'tar':
            if (args.length > 1 && args[0] === '-xvf') {
                const tarFile = args[1];
                if (tarFile === 'my_archive2.tar.bz2') {
                    const extractFiles = (files, index = 0) => {
                        if (index < files.length) {
                            const file = files[index];
                            const fileName = file.split('/').pop();
                            fileSystem[currentDir][fileName] = `Content of ${fileName}`;
                            setTimeout(() => {
                                outputElem.innerHTML += `<div>./${file}</div>`;
                                outputElem.scrollTop = outputElem.scrollHeight;
                                extractFiles(files, index + 1);
                            }, 200);  // 200ms delay between files
                        }
                    };
                    extractFiles(tarballContent);
                    return;  // return early to prevent clearing input while files are being extracted
                } else {
                    output = `tar: ${tarFile}: Cannot open: No such file or directory`;
                }
            } else {
                output = 'tar: Missing option';
            }
            break;
        default:
            output = `${cmd}: command not found`;
            break;
    }

    if (output) {
        outputElem.innerHTML += `<div>${output}</div>`;
    }
    inputElem.value = '';
    outputElem.scrollTop = outputElem.scrollHeight;
}

document.getElementById('input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        handleCommand(this.value);
    }
});
