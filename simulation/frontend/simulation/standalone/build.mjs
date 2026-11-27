import { readFile, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url))
const template = await readFile(`${dir}index.html`, 'utf8')
const bundle = (await readFile(`${dir}dist/dujiangyan.js`, 'utf8')).replace(/<\/script/gi, '<\\/script')

if (!template.includes('<!--BUNDLE-->')) {
  throw new Error('standalone/index.html 缺少 <!--BUNDLE--> 占位')
}

// 用函数做替换：bundle 里含有 $& / $` 之类的序列，字符串替换会把它们当成占位符，
// 结果是把模板的前缀整段复制进产物（两次 <!doctype>）。
const html = template.replace('<!--BUNDLE-->', () => `<script>\n${bundle}\n</script>`)
await writeFile(`${dir}dist/dujiangyan.html`, html)

const { size } = await stat(`${dir}dist/dujiangyan.html`)
console.log(`dujiangyan.html  ${(size / 1024 / 1024).toFixed(2)} MB  (bundle ${(bundle.length / 1024).toFixed(0)} kB)`)
