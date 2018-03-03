{ Disposable } = require 'atom'
fs = require 'fs'
path = require 'path'
chokidar = require 'chokidar'

checkNested = (obj) ->
  args = Array::slice.call(arguments, 1)
  i = 0
  while i < args.length
    if !obj or !obj.hasOwnProperty(args[i])
      return false
    obj = obj[args[i]]
    i++
  true

incrementCounts = (counts, count, structure) ->
  counts[count] += 1
  switch count
    when 'part'
      if checkNested(structure, "parts", counts.part, "chapters")
        structure.parts[counts.part].chapters = structure.parts[counts.part].chapters.slice(0, counts.chapter)
      counts['chapter'] = 0
      counts['section'] = 0
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'chapter'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections")
        structure.parts[counts.part].chapters[counts.chapter].sections = structure.parts[counts.part].chapters[counts.chapter].sections.slice(0, counts.section)
      counts['section'] = 0
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'section'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections", counts.section, "subsections")
        structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections = structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections.slice(0, counts.section)
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'subsection'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections", counts.section, "subsections", counts.subsection, "subsubsections")
        structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections = structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections.slice(0, counts.section)
      counts['subsubsection'] = 0
      break
  return counts

module.exports =
class Manager extends Disposable
  constructor: (latex) ->
    @latex = latex
    @disable_watcher = atom.config.get "atom-latex.disable_watcher"
    @watched = []

  rootDir: ->
    # Collect all open TextEditors with LaTeX grammar
    texEditors = (editor for editor in atom.workspace.getTextEditors()\
                    when editor.getGrammar().scopeName.match(/text.tex.latex/))
    if atom.workspace.getActiveTextEditor() in texEditors # An active TeXeditor is open
      return atom.project.relativizePath(atom.workspace.getActiveTextEditor().getPath())[0]
    else if texEditors.length > 0   # First open editor with LaTeX grammar
      return atom.project.relativizePath(texEditors[0].getPath())[0]
    else # backup, return first active project
        @latex.logger.log.push {
          type: status
          text: "No active TeX editors were open - Setting Project: #{atom.project.getPaths()[0]}"
        }
      return atom.project.getPaths()[0]

  getFigures: (text, startLine) ->
    chapterReg = /(?:\\(part|chapter|section|subsection|subsubsection)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/
    figures = []
    searchText = []
    for line, lineNo in text.split(/\r?\n/).slice(startLine)
      if !chapterReg.test(line)
        searchText.push(line)
      else
        break
    searchText = searchText.join("\n")
    figureReg = /\\begin{(figure|table|algorithm)}(?:[\s\S]*?)(?:\\caption(?:\[([^\[\]\{\}]*)\])?){([^}]*)}(?:[\s\S]*?)\\end{\1}/g

    while (m = figureReg.exec(searchText))
        if m
          m.line = startLine + searchText.slice(0, m.index).split(/\r?\n/).length
          m.title = if m[2] then m[2] else m[3]
          m.type = m[1]
          figures.push(m)
    return figures

  getStructure:(file, structure, counts)->
    text = fs.readFileSync(file, 'utf8')
    inputReg = /(?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/
    chapterReg = /(?:\\(part|chapter|section|subsection|subsubsection)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/
    for line, lineNo in text.split(/\r?\n/)
      line = line.trim()
      lineNo++
      if line == "" || line.startsWith("%")
        continue
      f = inputReg.exec(line)
      i = chapterReg.exec(line)
      if f
        inputFile = f[1]
        if path.extname(inputFile) == ''
          inputFile += '.tex'
        structure = this.getStructure(path.join(@latex.homeDir,inputFile), structure, counts)
      else if i
        incrementCounts(counts, i[1], structure)

        # parts
        structure.parts = if structure.parts then structure.parts else []
        structure.parts[counts.part] = if structure.parts[counts.part] then structure.parts[counts.part] else {index: "#{counts.part}"}
        # chapters
        if i[1] == 'subsubsection' || i[1] == 'subsection' || i[1] == 'section' || i[1] == 'chapter'
          structure.parts[counts.part].chapters = if structure.parts[counts.part].chapters then structure.parts[counts.part].chapters else []
          structure.parts[counts.part].chapters[counts.chapter] = if structure.parts[counts.part].chapters[counts.chapter] then structure.parts[counts.part].chapters[counts.chapter] else {index: "#{counts.part}-#{counts.chapter}"}
        # sections
        if i[1] == 'subsubsection' || i[1] == 'subsection' || i[1] == 'section'
          structure.parts[counts.part].chapters[counts.chapter].sections = if structure.parts[counts.part].chapters[counts.chapter].sections then structure.parts[counts.part].chapters[counts.chapter].sections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}"}
        # subsections
        if i[1] == 'subsubsection' || i[1] == 'subsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}"}
        # subsubsections
        if i[1] == 'subsubsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}-#{counts.subsubsection}"}

        if i[1] == 'part'
          structure.parts[counts.part].title = i[2]
          structure.parts[counts.part].file = file
          structure.parts[counts.part].line = lineNo
          structure.parts[counts.part].index = "#{counts.part}"
          structure.parts[counts.part].figures = this.getFigures(text, lineNo)
        if i[1] == 'chapter'
          structure.parts[counts.part].chapters[counts.chapter].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].file = file
          structure.parts[counts.part].chapters[counts.chapter].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].index = "#{counts.part}-#{counts.chapter}"
          structure.parts[counts.part].chapters[counts.chapter].figures = this.getFigures(text, lineNo)
        if i[1] == 'section'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].index = "#{counts.part}-#{counts.chapter}-#{counts.section}"
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].figures = this.getFigures(text, lineNo)
        if i[1] == 'subsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].index = "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}"
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].figures = this.getFigures(text, lineNo)
        if i[1] == 'subsubsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].index = "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}-#{counts.subsubsection}"
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].figures = this.getFigures(text, lineNo)
    return structure

  loadLocalCfg: ->
    if @lastCfgTime? and Date.now() - @lastCfgTime < 200 or\
       !atom.workspace.getActiveTextEditor()?
      return @config?
    @lastCfgTime = Date.now()
    rootDir = @rootDir()
    return false if !rootDir?
    if '.latexcfg' in fs.readdirSync rootDir
      try
        filePath = path.join rootDir, '.latexcfg'
        fileContent = fs.readFileSync filePath, 'utf-8'
        @config = JSON.parse fileContent
        if @config.root?
          @config.root = path.resolve rootDir, @config.root
        return true
      catch err
        console.log err
    return false

  isTexFile: (name) ->
    @latex.manager.loadLocalCfg()
    if path.extname(name) in ['.tex','.tikz'] or \
        @latex.manager.config?.latex_ext?.indexOf(path.extname(name)) > -1
      return true
    return false

  findMain: (here) ->
    result = @findMainSequence(here)
    if result and !fs.existsSync(@latex.mainFile)
      @latex.logger.processError(
        "Invalid LaTeX root file `#{path.basename(@latex.mainFile)}`",
        "The path #{@latex.mainFile} does not exist!", true,
        [{
          text: "Set LaTeX root"
          onDidClick: =>
            @latex.manager.refindMain()
            @latex.logger.clearBuildError()
        }])
      return false
    # @latex.panel.view.update()
    return result

  refindMain: () ->
    input = document.getElementById('atom-latex-root-input')
    input.onchange = (=>
      if input.files.length > 0
        @latex.mainFile = input.files[0].path
      # @latex.panel.view.update()
    )
    input.click()

  findMainSequence: (here) ->
    if here
      return true if @findMainSelfMagic()
      return true if @findMainSelf()

    # Check if the mainFile is part of the curent project path
    if @latex.mainFile? and atom.project.relativizePath(@latex.mainFile)[0] == @rootDir()
      return true

    return true if @findMainConfig()
    return true if @findMainSelfMagic()
    return true if @findMainSelf()
    return true if @findMainAllRoot()

    @latex.logger.missingMain()
    return false

  findMainSelf: ->
    docRegex = /\\begin{document}/
    editor = atom.workspace.getActivePaneItem()
    currentPath = editor?.buffer.file?.path
    currentContent = editor?.getText()

    if currentPath and currentContent
      if @isTexFile(currentPath) and currentContent.match(docRegex)
        @latex.mainFile = currentPath
        # @latex.logger.setMain('self')
        return true
    return false

  findMainSelfMagic: ->
    magicRegex = /(?:%\s*!TEX\sroot\s*=\s*([^\s]*\.tex)$)/m
    editor = atom.workspace.getActivePaneItem()
    currentPath = editor?.buffer.file?.path
    currentContent = editor?.getText()

    if currentPath and currentContent
      if @isTexFile(currentPath)
        result = currentContent.match magicRegex
        if result
          @latex.mainFile = path.resolve(path.dirname(currentPath), result[1])
          # @latex.logger.setMain('magic')
          return true
    return false

  findMainConfig: ->
    @loadLocalCfg()
    if @config?.root
      @latex.mainFile = @config.root
      # @latex.logger.setMain('config')
      return true
    return false

  findMainAllRoot: ->
    docRegex = /\\begin{document}/
    for rootDir in atom.project.getPaths()
      for file in fs.readdirSync rootDir
        continue if !@isTexFile(file)
        filePath = path.join rootDir, file
        fileContent = fs.readFileSync filePath, 'utf-8'
        if fileContent.match docRegex
          @latex.mainFile = filePath
          # @latex.logger.setMain('all')
          return true
    return false

  findPDF: ->
    if !@findMain()
      return false
    # mainFile.blah.tex -> mainFile.pdf
    return @latex.mainFile.replace(/\.([^\/]*)$/, '.pdf')
