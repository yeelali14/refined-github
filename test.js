const context = {};
  
  import { readFileSync } from 'fs';
  import { execSync } from 'child_process';
  
  const SOURCE_CODE_WORKING_DIRECTORY = './code';
  const CWD = { cwd: SOURCE_CODE_WORKING_DIRECTORY };
  
  export const readRemoteFile = (file, branch) => {
    execSync(`git config --global --add safe.directory '*'`).toString();
    try {
      execSync(`git show '${branch}:${file}' > '${file}'`).toString();
      return readFileSync(`${SOURCE_CODE_WORKING_DIRECTORY}/${file}`, 'utf8');
    } catch {
      return '';
    }
  };
  
  const calculateLinesPercentage = (authorLines, allLinesCount) =>
    authorLines && allLinesCount
      ? authorLines >= allLinesCount
        ? 100
        : parseInt(((authorLines / allLinesCount) * 100)?.toFixed(0))
      : 0;
  
  export const formatDateToDays = (date) => {
    if (!date) {
      return 0;
    }
    const today = new Date();
    const formattedDate = new Date(date);
    return Math.abs(parseInt((formattedDate - today) / (1000 * 60 * 60 * 24), 10));
  };
  
  const getAllAuthorsOfFile = (file, branch) =>
    [
      ...new Set(
        execSync(
          `git blame ${branch} --line-porcelain -- '${file}' | grep '^author-mail\\|^author ' | sed '$!N;s/\\n/ /'`
        )
          .toString()
          ?.replaceAll('author ', '')
          ?.replaceAll('author-mail ', '')
          ?.split('\n')
      )
    ]?.filter(Boolean);
  
  const getStatisticsForFile = (author, file, branch) =>
    execSync(
      `git log ${branch} --ignore-blank-lines --author='${author}' --pretty=tformat: --numstat -- '${file}' | awk '{inserted+=$1; deleted+=$2; delta+=$1-$2; if(inserted > 0) ratio=deleted/inserted; } END { if(inserted) printf "%s,%s,%s,1:%s", inserted, deleted, delta, ratio; else printf "" }'`
    ).toString();
  
  const getAuthorLines = (author, file, branch) => {
    const formattedAuthor = author?.substring(author.indexOf('<') + 1, author.indexOf('>'));
    return execSync(
      `git blame ${branch} --line-porcelain -- '${file}' | sed -n 's/^author-mail //p' | sort | uniq -c | sort -rn | grep '${formattedAuthor}'`
    )
      .toString()
      ?.split('<')?.[0]
      ?.trim();
  };
  
  const calculateStatisticsForBlame = (author, file, branch) => {
    let statsString = '';
    let authorLines = '';
  
    statsString = getStatisticsForFile(author, file, branch);
    if (statsString) {
      authorLines = parseInt(getAuthorLines(author, file, branch));
    }
    const allLinesCount = parseInt(getCodeLinesCount(file, branch));
  
    console.log('calculateStatisticsForBlame: ', {
      statsString,
      authorLines,
      allLinesCount
    });
  
    return { statsString, authorLines, allLinesCount };
  };
  
  export const getCodeLinesCount = (file, branch) => readRemoteFile(file, branch)?.split(/\r\n|\r|\n/)?.length;
  
  export const extractStatsFromRawItems = (rawItems) =>
    rawItems?.reduce((acc, item) => {
      const author = {
        [item.replace(/ /g, '').trim().split('\t')[1]]: {
          count: item.replace(/ /g, '').trim().split('\t')[0]
        }
      };
      return { ...acc, ...author };
    }, {});
  
  const blameByAuthor = (files, branch) => {
    return {
      ...files.reduce((acc, file) => {
        const authors = getAllAuthorsOfFile(file, branch);
        return {
          ...acc,
          ...{
            [file]: authors.reduce((prevAuthor, author) => {
              const { authorLines, allLinesCount } = calculateStatisticsForBlame(author, file, branch);
              return {
                ...prevAuthor,
                [author]: calculateLinesPercentage(authorLines, allLinesCount)
              };
            }, {})
          }
        };
      }, {})
    };
  };
  
  /// ### start here
  const contributersStatContext = (context) => {
    console.log('base:', context.files, context.branch?.base);
    const blames = blameByAuthor(context.files, context.branch.base);
    return {
      age: formatDateToDays(getRepoFirstCommitDate(context.branch.base)),
      author_age: formatDateToDays(commitsDateByAuthor(context.branch.author, context.branch.base)?.[0]),
      blame: Object.keys(blames).reduce((acc, file) => {
        return {
          ...acc,
          ...{ [file]: blames[file] }
        };
      }, {})
    };
  };
  
  console.log(contributersStatContext(context));
  