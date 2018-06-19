/* eslint-disable id-match */
'use strict';

require('./init-test');

const
   path = require('path'),
   root = __dirname,
   application = 'fixture/custompack',
   applicationRoot = path.join(root, application),
   fs = require('fs-extra'),
   packHelpers = require('../lib/pack/helpers/custompack'),
   customPacker = require('../lib/pack/custom-packer'),
   { rebaseCSS } = require('../lib/pack/custom-packer'),
   DependencyGraph = require('../packer/lib/dependencyGraph');

describe('custompack', () => {
   let result;
   it('should reject error if include option not exists', async() => {
      try {
         const
            moduleDeps = await fs.readJson(path.join(applicationRoot, 'module-dependencies.json')),
            currentNodes = Object.keys(moduleDeps.nodes),
            currentLinks = Object.keys(moduleDeps.links),
            depsTree = new DependencyGraph();

         if (currentLinks.length > 0) {
            currentLinks.forEach((link) => {
               depsTree.setLink(link, moduleDeps.links[link]);
            });
         }
         if (currentNodes.length > 0) {
            currentNodes.forEach((node) => {
               const currentNode = moduleDeps.nodes[node];
               currentNode.path = currentNode.path.replace(/^resources\//, '');
               depsTree.setNode(node, currentNode);
            });
         }
         const config = await fs.readJson(path.join(applicationRoot, 'configs/without-include.package.json'));
         const configsArray = packHelpers.getConfigsFromPackageJson(
            path.normalize('configs/without-include.package.json'),
            applicationRoot,
            config
         );
         const currentResult = await customPacker.generateCustomPackage(
            depsTree,
            root,
            application,
            configsArray[0],
            true,
            true,
            []
         );
         result = currentResult;
      } catch (err) {
         result = err;
      }

      (result instanceof Error).should.equal(true);
      result.message.should.equal('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.');
   });
   const testCssPath = path.join(applicationRoot, 'packcss/testRebaseURL.css');
   it('rebaseUrl correct path without url-service-path', async() => {
      const urlServicePath = '/';
      const resultCSS = await rebaseCSS(
         testCssPath,
         applicationRoot,
         urlServicePath,

         // isGulp
         true
      );
      resultCSS.should.equal('.online-Sidebar_logoDefault{background-image:url(/resources/packcss/images/logo-en.svg)}\r\n');
   });
   it('rebaseUrl correct path with url-service-path', async() => {
      const urlServicePath = '/someTestPath/';
      const resultCSS = await rebaseCSS(
         testCssPath,
         applicationRoot,
         urlServicePath,

         // isGulp
         true
      );
      resultCSS.should.equal('.online-Sidebar_logoDefault{background-image:url(/someTestPath/resources/packcss/images/logo-en.svg)}\r\n');
   });
});
