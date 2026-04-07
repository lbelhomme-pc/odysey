export function createBlockKey(pageNumber, blockIndex) {
  return `${pageNumber}-${blockIndex}`;
}

export function getFirstReadableBlockKey(importedDocument) {
  const firstNonEmptyPage = importedDocument?.pages?.find((page) => page.blocks.length > 0);
  return firstNonEmptyPage ? createBlockKey(firstNonEmptyPage.pageNumber, 0) : "";
}

export function countDocumentBlocks(importedDocument) {
  return (importedDocument?.pages || []).reduce((sum, page) => sum + page.blocks.length, 0);
}

export function summarizeDocumentDiagnostics(importedDocument) {
  return (importedDocument?.pages || []).reduce(
    (summary, page) => {
      let pageHasMath = false;
      let pageHasVerification = false;

      for (const block of page.blocks) {
        const isMathBlock = block.type === "formula" || Boolean(block?.math?.containsMath);
        const needsVerification = Boolean(block?.verification?.level && block.verification.level !== "none");

        if (isMathBlock) {
          summary.mathBlockCount += 1;
          pageHasMath = true;
        }

        if (block.type === "formula") {
          summary.formulaBlockCount += 1;
        }

        if (needsVerification) {
          summary.verificationBlockCount += 1;
          pageHasVerification = true;
          for (const reason of block.verification.reasons || []) {
            if (!summary.verificationReasons.includes(reason)) {
              summary.verificationReasons.push(reason);
            }
          }
        }
      }

      if (pageHasMath) {
        summary.pagesWithMath += 1;
      }

      if (pageHasVerification) {
        summary.pagesWithVerification += 1;
      }

      return summary;
    },
    {
      mathBlockCount: 0,
      formulaBlockCount: 0,
      verificationBlockCount: 0,
      pagesWithMath: 0,
      pagesWithVerification: 0,
      verificationReasons: []
    }
  );
}

export function pickDocumentPages(importedDocument, scope = "document") {
  if (!importedDocument?.pages) {
    return [];
  }

  if (scope === "current-page" && importedDocument.pages[0]) {
    return [importedDocument.pages[0]];
  }

  return importedDocument.pages;
}
