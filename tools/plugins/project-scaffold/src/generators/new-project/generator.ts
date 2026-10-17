import { generateFiles, Tree } from '@nx/devkit';
import { join } from 'path';

export interface NewProjectGeneratorOptions {
  name: string;
  displayName: string;
  shortDescription: string;
}

export default async function newProjectGenerator(
  tree: Tree,
  options: NewProjectGeneratorOptions
): Promise<void> {
  const projectRoot = join('projects', options.name);

  if (tree.exists(projectRoot)) {
    throw new Error(`Project "${options.name}" already exists`);
  }

  generateFiles(
    tree,
    join(__dirname, 'files'),
    projectRoot,
    {
      ...options,
      template: ''
    }
  );
}
