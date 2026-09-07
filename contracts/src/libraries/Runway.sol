// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Funded-until projection, byte-for-byte the algorithm in
/// packages/core/src/runway.ts (`runwayYears`). Both are pinned by tests; change together.
library Runway {
    uint256 internal constant HORIZON_YEARS = 500;

    /// @param assets Token units earmarked for the name.
    /// @param blockCost Cost of one renewal block, token units.
    /// @param blockYears Years bought by one block.
    /// @param rateBps Annual yield, basis points.
    /// @return Years of coverage from now; HORIZON_YEARS when self-sustaining.
    function coveredYears(uint256 assets, uint256 blockCost, uint256 blockYears, uint256 rateBps)
        internal
        pure
        returns (uint256)
    {
        if (blockCost == 0 || blockYears == 0) return 0;
        uint256 covered;
        for (uint256 year; year < HORIZON_YEARS; ++year) {
            if (covered <= year) {
                if (assets < blockCost) return covered;
                assets -= blockCost;
                covered = year + blockYears;
            }
            assets += assets * rateBps / 10_000;
        }
        return HORIZON_YEARS;
    }
}
